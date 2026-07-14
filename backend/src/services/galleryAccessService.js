const { normalizePostPaymentAccessDays } = require('./deliveryModeService');

function postPaymentExpiry(approvedAt, accessDays) {
  const approvedTime = new Date(approvedAt).getTime();
  if (!Number.isFinite(approvedTime)) return null;
  return new Date(approvedTime + normalizePostPaymentAccessDays(accessDays) * 86_400_000);
}

function createGalleryAccessService({ repos }) {
  async function promoteAfterPayment(session) {
    if (!session?.shareToken || !session.approvedAt) return null;
    const share = await repos.getShareSession(session.shareToken, { includeAccessCode: true });
    if (!share || share.deletedAt || share.revokedAt || share.status === 'revoked') return share;
    const expiresAt = postPaymentExpiry(session.approvedAt, share.postPaymentAccessDays);
    if (!expiresAt || typeof repos.promoteShareAfterPayment !== 'function') return share;
    return repos.promoteShareAfterPayment(share.token, expiresAt);
  }

  return { promoteAfterPayment };
}

module.exports = { createGalleryAccessService, postPaymentExpiry };
