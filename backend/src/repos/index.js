const { createPool, withTransaction } = require('../db');
const { createCredentialRepo } = require('./credentials');
const { createConversionEventRepo } = require('./conversionEvents');
const { createDeliveryJobRepo } = require('./deliveryJobs');
const { createDownloadEntitlementRepo } = require('./downloadEntitlements');
const { createPaymentEventRepo } = require('./paymentEvents');
const { createPhotoRepo } = require('./photos');
const { createOverlayAssetRepo } = require('./overlayAssets');
const { createSessionRepo } = require('./sessions');
const { createSettingsRepo } = require('./settings');
const { createShareSessionRepo } = require('./shareSessions');
const { createWatermarkAssetRepo } = require('./watermarkAssets');
const { fromCents, toCents } = require('./mappers');

function createRepos(config) {
  const pool = createPool(config);

  async function query(sql, params = []) {
    return pool.query(sql, params);
  }

  async function close() {
    await pool.end();
  }

  const context = { config, pool, query, withTransaction };
  const photos = createPhotoRepo(context);
  const sessions = createSessionRepo(context);
  const shareSessions = createShareSessionRepo({
    attachPhotosToSession: photos.attachPhotosToSession,
    cancelPendingSessionsForShare: sessions.cancelPendingSessionsForShare,
    query,
  });

  return {
    query,
    ...photos,
    ...sessions,
    ...shareSessions,
    ...createConversionEventRepo({ query }),
    ...createCredentialRepo({ query }),
    ...createDeliveryJobRepo({ query }),
    ...createDownloadEntitlementRepo(context),
    ...createPaymentEventRepo({ query }),
    ...createSettingsRepo(context),
    ...createOverlayAssetRepo(context),
    ...createWatermarkAssetRepo(context),
    close,
  };
}

module.exports = { createRepos, fromCents, toCents };
