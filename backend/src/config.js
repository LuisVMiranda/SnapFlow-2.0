const path = require('path');

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function createConfig() {
  return {
    port: Number(process.env.PORT) || 3000,
    databaseUrl: process.env.DATABASE_URL || '',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:5173',
    adminAccessToken: process.env.ADMIN_ACCESS_TOKEN || '',
    mercadoPagoAccessToken: process.env.MP_ACCESS_TOKEN || '',
    mercadoPagoWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
    credentialsSecret: process.env.CREDENTIALS_SECRET || process.env.ADMIN_ACCESS_TOKEN || '',
    storageRoot: process.env.STORAGE_ROOT
      ? path.resolve(process.env.STORAGE_ROOT)
      : path.join(__dirname, '..', 'storage'),
    maxUploadMb: numberFromEnv('MAX_UPLOAD_MB', 25),
    maxFilesPerUpload: numberFromEnv('MAX_FILES_PER_UPLOAD', 100),
    defaultGalleryRetentionDays: numberFromEnv('DEFAULT_GALLERY_RETENTION_DAYS', 30),
    deliveredPhotoRetentionDays: numberFromEnv('DELIVERED_PHOTO_RETENTION_DAYS', 30),
    expiredShareRetentionDays: numberFromEnv('EXPIRED_SHARE_RETENTION_DAYS', 7),
    autoCleanupEnabled: String(process.env.AUTO_CLEANUP_ENABLED || 'false') === 'true',
  };
}

module.exports = { createConfig };
