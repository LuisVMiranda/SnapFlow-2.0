const { HttpError } = require('../errors');
const { hashValue, randomToken } = require('../tokens');

const accessTokens = new Map();
const TOKEN_TTL_MS = 20 * 60 * 1000;

function isExpired(share, now = new Date()) {
  if (!share) return true;
  if (share.revokedAt || share.status === 'revoked') return true;
  return new Date(share.expiresAt).getTime() <= now.getTime();
}

function publicSharePayload(share) {
  const expired = isExpired(share);
  return {
    token: share.token,
    galleryName: share.galleryName || '',
    galleryDescription: share.galleryDescription || '',
    packageType: share.packageType,
    clientName: share.clientName || '',
    clientEmail: share.clientEmail || '',
    photoCount: share.photoCount,
    subtotal: share.subtotal,
    discountAmount: share.discountAmount,
    total: share.total,
    link: share.link,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt,
    status: expired ? 'expired' : share.status,
    expired,
  };
}

function issueCustomerAccessToken(shareToken) {
  const token = randomToken(24);
  accessTokens.set(token, {
    shareToken,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

function validateCustomerAccess(req, expectedShareToken = null) {
  const header = req.get('authorization') || '';
  const queryToken = req.query.access_token || req.query.token;
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1] || queryToken;
  const record = accessTokens.get(token);
  if (!record || record.expiresAt <= Date.now()) {
    throw new HttpError(403, 'Acesso de mídia inválido ou expirado. Abra novamente o link da galeria e digite o código de acesso.', 'media_access_denied');
  }
  if (expectedShareToken && record.shareToken !== expectedShareToken) {
    throw new HttpError(403, 'Esta foto não pertence à galeria liberada. Atualize a página e tente novamente.', 'media_share_mismatch');
  }
  return record;
}

function validateAccessCode(input, storedHash) {
  return hashValue(String(input || '').trim().toUpperCase()) === storedHash;
}

module.exports = {
  isExpired,
  publicSharePayload,
  issueCustomerAccessToken,
  validateCustomerAccess,
  validateAccessCode,
};
