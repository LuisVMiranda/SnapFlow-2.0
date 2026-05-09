const { createPool, withTransaction } = require('../db');
const { createCredentialRepo } = require('./credentials');
const { createDeliveryJobRepo } = require('./deliveryJobs');
const { createPaymentEventRepo } = require('./paymentEvents');
const { createPhotoRepo } = require('./photos');
const { createSessionRepo } = require('./sessions');
const { createSettingsRepo } = require('./settings');
const { createShareSessionRepo } = require('./shareSessions');
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
    ...createCredentialRepo({ query }),
    ...createDeliveryJobRepo({ query }),
    ...createPaymentEventRepo({ query }),
    ...createSettingsRepo(context),
    close,
  };
}

module.exports = { createRepos, fromCents, toCents };
