const {
  LEGACY_DELIVERY_MODE,
  allowsWhatsappDelivery,
  normalizeDeliveryMode,
} = require('./deliveryModeService');
const { validateClientPhone } = require('./phone');

async function modeForSession(repos, session) {
  if (!session?.shareToken || typeof repos.getShareSession !== 'function') return LEGACY_DELIVERY_MODE;
  const share = await repos.getShareSession(session.shareToken);
  return normalizeDeliveryMode(share?.deliveryMode, LEGACY_DELIVERY_MODE);
}

async function promoteGallery(galleryAccess, session) {
  if (!session.shareToken || !galleryAccess?.promoteAfterPayment) return null;
  return galleryAccess.promoteAfterPayment(session);
}

async function createDownloadEntitlements(repos, session) {
  if (!session.shareToken || typeof repos.createDownloadEntitlementsForSession !== 'function') return;
  await repos.createDownloadEntitlementsForSession(session.id, session.shareToken);
}

function canSendApprovalNotification(session, share) {
  if (!session.shareToken || share?.revokedAt || share?.status === 'revoked') return false;
  return validateClientPhone(session.phone || share?.phone).valid;
}

async function enqueueApprovalNotification(deliveryQueue, session, share) {
  if (!canSendApprovalNotification(session, share)) return;
  await deliveryQueue.enqueue(session.id, 'approval_notification').catch((error) => {
    console.warn(`Não foi possível enfileirar o aviso de pagamento: ${error.message}`);
  });
}

async function enqueueOriginals(deliveryQueue, repos, session) {
  await repos.updateDeliveryStatus(session.id, 'queued');
  await deliveryQueue.enqueue(session.id, 'media').catch(async (error) => {
    await repos.updateDeliveryStatus(session.id, 'failed', error.message).catch(() => {});
    console.warn(`Não foi possível enfileirar os originais: ${error.message}`);
  });
}

function createDeliveryReleaseService({ deliveryQueue, galleryAccess, repos }) {
  async function releaseApprovedSession(session) {
    if (!session || session.status !== 'approved') return session;

    const promotedShare = await promoteGallery(galleryAccess, session);
    const deliveryMode = await modeForSession(repos, session);

    await createDownloadEntitlements(repos, session);
    await enqueueApprovalNotification(deliveryQueue, session, promotedShare);

    if (allowsWhatsappDelivery(deliveryMode)) {
      await enqueueOriginals(deliveryQueue, repos, session);
    } else {
      await repos.updateDeliveryStatus(session.id, 'download_available');
    }

    return repos.getSession(session.id);
  }

  return { releaseApprovedSession };
}

module.exports = { createDeliveryReleaseService };
