const DEFAULT_SHARE_EXPIRES_MINUTES = 30;
const MIN_SHARE_EXPIRES_MINUTES = 5;
const MAX_SHARE_EXPIRES_MINUTES = 180;

function normalizeShareExpiresMinutes(value, fallback = DEFAULT_SHARE_EXPIRES_MINUTES) {
  const parsed = Number(value);
  const fallbackMinutes = Number.isFinite(Number(fallback)) && Number(fallback) > 0
    ? Number(fallback)
    : DEFAULT_SHARE_EXPIRES_MINUTES;
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMinutes;
  return Math.min(MAX_SHARE_EXPIRES_MINUTES, Math.max(MIN_SHARE_EXPIRES_MINUTES, minutes));
}

function shareExpiresAtFromNow(value = DEFAULT_SHARE_EXPIRES_MINUTES, now = new Date()) {
  const minutes = normalizeShareExpiresMinutes(value);
  return {
    expiresAt: new Date(now.getTime() + minutes * 60 * 1000),
    minutes,
  };
}

module.exports = {
  DEFAULT_SHARE_EXPIRES_MINUTES,
  MAX_SHARE_EXPIRES_MINUTES,
  MIN_SHARE_EXPIRES_MINUTES,
  normalizeShareExpiresMinutes,
  shareExpiresAtFromNow,
};
