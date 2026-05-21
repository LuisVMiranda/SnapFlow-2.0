const path = require('path');

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function boundedNumberFromEnv(name, fallback, min, max) {
  const value = numberFromEnv(name, fallback);
  return Math.min(max, Math.max(min, value));
}

function booleanFromEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function autoEnhanceLevelFromEnv(value) {
  const normalized = String(value || 'balanced').trim().toLowerCase();
  return ['soft', 'balanced', 'cinematic'].includes(normalized) ? normalized : 'balanced';
}

function createConfig() {
  return {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || '127.0.0.1',
    databaseUrl: process.env.DATABASE_URL || '',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:5173',
    adminAccessToken: process.env.ADMIN_ACCESS_TOKEN || '',
    mercadoPagoAccessToken: process.env.MP_ACCESS_TOKEN || '',
    mercadoPagoWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
    credentialsSecret: process.env.CREDENTIALS_SECRET || process.env.ADMIN_ACCESS_TOKEN || '',
    adminLockMinutes: boundedNumberFromEnv('ADMIN_LOCK_MINUTES', 30, 30, 60),
    storageRoot: process.env.STORAGE_ROOT
      ? path.resolve(process.env.STORAGE_ROOT)
      : path.join(__dirname, '..', 'storage'),
    maxUploadMb: numberFromEnv('MAX_UPLOAD_MB', 25),
    maxFilesPerUpload: numberFromEnv('MAX_FILES_PER_UPLOAD', 100),
    uploadProcessingConcurrency: boundedNumberFromEnv('UPLOAD_PROCESSING_CONCURRENCY', 3, 1, 6),
    defaultGalleryRetentionDays: numberFromEnv('DEFAULT_GALLERY_RETENTION_DAYS', 30),
    deliveredPhotoRetentionDays: numberFromEnv('DELIVERED_PHOTO_RETENTION_DAYS', 30),
    expiredShareRetentionDays: numberFromEnv('EXPIRED_SHARE_RETENTION_DAYS', 7),
    autoCleanupEnabled: String(process.env.AUTO_CLEANUP_ENABLED || 'false') === 'true',
    autoEnhanceEnabled: booleanFromEnv('AUTO_ENHANCE', false),
    autoEnhanceLevel: autoEnhanceLevelFromEnv(process.env.AUTO_ENHANCE_LEVEL),
  };
}

module.exports = { createConfig };
