const { shareExpiresAtFromNow } = require('../services/shareExpiration');
const { addDays, generateAccessCode } = require('../tokens');
const { createOrRestoreShareSession, resolvePublicBaseUrl } = require('./adminShareSessionCreation');

async function createSaleGallery({ config, credentials, clientEmail, clientName, phone, photoIds, repos, req, totals }) {
  const now = new Date();
  const retentionExpiresAt = addDays(now, config.defaultGalleryRetentionDays);
  const { expiresAt } = shareExpiresAtFromNow();
  return createOrRestoreShareSession({
    accessCode: generateAccessCode(4),
    baseUrl: await resolvePublicBaseUrl(req, config, credentials),
    expiresAt,
    galleryDescription: '',
    galleryName: clientName ? `Venda - ${clientName}` : 'Venda direta',
    phone,
    photoIds,
    repos,
    requestBody: {
      ...req.body,
      clientName,
      clientEmail,
      subtotal: totals.subtotal,
      discountAmount: totals.configuredDiscountAmount,
      total: totals.total,
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
