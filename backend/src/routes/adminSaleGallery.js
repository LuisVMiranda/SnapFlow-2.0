const { shareExpiresAtFromNow } = require('../services/shareExpiration');
const { addDays, generateAccessCode } = require('../tokens');
const { createOrRestoreShareSession, resolvePublicBaseUrl } = require('./adminShareSessionCreation');

async function createSaleGallery({ config, credentials, repos }, sale) {
  const now = new Date();
  const retentionExpiresAt = addDays(now, config.defaultGalleryRetentionDays);
  const { expiresAt } = shareExpiresAtFromNow();
  return createOrRestoreShareSession({
    accessCode: generateAccessCode(4),
    baseUrl: await resolvePublicBaseUrl(sale.req, config, credentials),
    expiresAt,
    galleryDescription: '',
    galleryName: sale.clientName ? `Venda - ${sale.clientName}` : 'Venda direta',
    phone: sale.phone,
    photoIds: sale.photoIds,
    repos,
    requestBody: {
      ...sale.req.body,
      clientName: sale.clientName,
      clientEmail: sale.clientEmail,
      subtotal: sale.totals.subtotal,
      discountAmount: sale.totals.configuredDiscountAmount,
      total: sale.totals.total,
      deliveryMode: sale.deliveryMode,
      postPaymentAccessDays: sale.postPaymentAccessDays,
    },
    retentionExpiresAt,
  });
}

async function assignInitialOverlay({ galleryOverlays, shareToken, body }) {
  const overlayAssetId = String(body.overlayAssetId || '').trim();
  if (!overlayAssetId || !galleryOverlays?.assignToShare || !shareToken) return null;
  return galleryOverlays.assignToShare(shareToken, {
    assetId: overlayAssetId,
    enabled: true,
    settings: body.overlaySettings,
  });
}

module.exports = { assignInitialOverlay, createSaleGallery };
