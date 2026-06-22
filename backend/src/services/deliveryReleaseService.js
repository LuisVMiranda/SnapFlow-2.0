const {
  LEGACY_DELIVERY_MODE,
  allowsWhatsappDelivery,
  normalizeDeliveryMode,
} = require('./deliveryModeService');

async function modeForSession(repos, session) {
  if (!session?.shareToken || typeof repos.getShareSession !== 'function') return LEGACY_DELIVERY_MODE;
  const share = await repos.getShareSession(session.shareToken);
  return normalizeDeliveryMode(share?.deliveryMode, LEGACY_DELIVERY_MODE);
}

function createDeliveryReleaseService({ deliveryQueue, repos }) {
  async function releaseApprovedSession(session) {
    if (!session || session.status !== 'approved') return session;
    const deliveryMode = await modeForSession(repos, session);

    if (session.shareToken && typeof repos.createDownloadEntitlementsForSession === 'function') {
      await repos.createDownloadEntitlementsForSession(session.id, session.shareToken);
    }

    if (allowsWhatsappDelivery(deliveryMode)) {
      await repos.updateDeliveryStatus(session.id, 'queued');
      await deliveryQueue.enqueue(session.id);
    } else {
      await repos.updateDeliveryStatus(session.id, 'download_available');
    }

    return repos.getSession(session.id);
  }

  return { releaseApprovedSession };
}

module.exports = { createDeliveryReleaseService };
