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

function textFromEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

function credentialsSecretFromEnv() {
  return textFromEnv('CREDENTIALS_SECRET', textFromEnv('ADMIN_ACCESS_TOKEN'));
}

function storageRootFromEnv() {
  const configuredRoot = textFromEnv('STORAGE_ROOT');
  return configuredRoot ? path.resolve(configuredRoot) : path.join(__dirname, '..', 'storage');
}

function createConfig() {
  return {
    port: numberFromEnv('PORT', 3000),
    host: textFromEnv('HOST', '127.0.0.1'),
    databaseUrl: textFromEnv('DATABASE_URL'),
    publicBaseUrl: textFromEnv('PUBLIC_BASE_URL', 'http://localhost:5173'),
    adminAccessToken: textFromEnv('ADMIN_ACCESS_TOKEN'),
    mercadoPagoAccessToken: textFromEnv('MP_ACCESS_TOKEN'),
    mercadoPagoWebhookSecret: textFromEnv('MP_WEBHOOK_SECRET'),
    credentialsSecret: credentialsSecretFromEnv(),
    adminLockMinutes: boundedNumberFromEnv('ADMIN_LOCK_MINUTES', 30, 30, 60),
    storageRoot: storageRootFromEnv(),
    maxUploadMb: numberFromEnv('MAX_UPLOAD_MB', 25),
    maxFilesPerUpload: numberFromEnv('MAX_FILES_PER_UPLOAD', 100),
    uploadProcessingConcurrency: boundedNumberFromEnv('UPLOAD_PROCESSING_CONCURRENCY', 3, 1, 6),
    defaultGalleryRetentionDays: numberFromEnv('DEFAULT_GALLERY_RETENTION_DAYS', 30),
    deliveredPhotoRetentionDays: numberFromEnv('DELIVERED_PHOTO_RETENTION_DAYS', 30),
    expiredShareRetentionDays: numberFromEnv('EXPIRED_SHARE_RETENTION_DAYS', 7),
    autoCleanupEnabled: booleanFromEnv('AUTO_CLEANUP_ENABLED', false),
    autoEnhanceEnabled: booleanFromEnv('AUTO_ENHANCE', false),
    autoEnhanceLevel: autoEnhanceLevelFromEnv(process.env.AUTO_ENHANCE_LEVEL),
    skipStartupMigrations: booleanFromEnv('SNAPFLOW_SKIP_STARTUP_MIGRATIONS', false),
  };
}

module.exports = { createConfig };
