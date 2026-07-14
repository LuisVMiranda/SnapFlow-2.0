const { publicBaseUrlForRequest } = require('./helpers');
const { hashValue, randomToken } = require('../tokens');

async function resolvePublicBaseUrl(req, config, credentials) {
  const savedUrl = typeof credentials.getSecretValue === 'function'
    ? await credentials.getSecretValue('publicBaseUrl')
    : '';
  return savedUrl || publicBaseUrlForRequest(req, config);
}

async function createOrRestoreShareSession({ accessCode, baseUrl, expiresAt, galleryDescription, galleryName, phone, photoIds, repos, requestBody, retentionExpiresAt }) {
  const existingShare = typeof repos.findShareWithExactPhotos === 'function'
    ? await repos.findShareWithExactPhotos(photoIds)
    : null;
  const token = existingShare?.token || randomToken(12);
  const stableAccessCode = existingShare?.accessCode || accessCode;
  const link = new URL(`/s/${token}`, baseUrl).toString();
  const payload = {
    token,
    accessCodeHash: existingShare?.accessCodeHash || hashValue(stableAccessCode),
    accessCode: stableAccessCode,
    phone: phone.stored,
    clientName: requestBody.clientName,
    clientEmail: requestBody.clientEmail,
    galleryName,
    galleryDescription,
    packageType: requestBody.packageType || 'eventos',
    photoCount: Number(requestBody.count) || photoIds.length,
    subtotal: Number(requestBody.subtotal) || 0,
    discountAmount: Number(requestBody.discountAmount) || 0,
    total: Number(requestBody.total) || 0,
    expiresAt,
    retentionExpiresAt,
    link,
    photoIds,
    storyDeliveryEnabled: requestBody.storyDeliveryEnabled === true,
    deliveryMode: requestBody.deliveryMode,
    postPaymentAccessDays: requestBody.postPaymentAccessDays,
  };

  const share = existingShare && typeof repos.restoreShareSession === 'function'
    ? await repos.restoreShareSession(existingShare.token, payload)
    : await repos.createShareSession(payload);

  if (share && typeof repos.deleteDetachedShareDuplicates === 'function') {
    await repos.deleteDetachedShareDuplicates(share);
  }

  return { accessCode: stableAccessCode, link, share };
}

module.exports = { createOrRestoreShareSession, resolvePublicBaseUrl };
