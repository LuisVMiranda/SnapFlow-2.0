const { rowToPhoto } = require('./mappers');

function normalizePhotoIds(rows = []) {
  return rows.map((row) => String(row.photo_id || '')).filter(Boolean);
}

function createDownloadEntitlementRepo({ config, query }) {
  async function createDownloadEntitlementsForSession(sessionId, shareToken = null) {
    const result = await query(
      `insert into download_entitlements (share_token, session_id, photo_id)
       select coalesce($2, p.share_token), $1, p.id
       from photos p
       where p.session_id = $1
         and p.deleted_at is null
         and coalesce($2, p.share_token) is not null
       on conflict (share_token, photo_id) do nothing
       returning *`,
      [sessionId, shareToken || null]
    );
    return result.rows;
  }

  async function listDownloadEntitlementPhotoIds(shareToken) {
    const result = await query(
      `select photo_id
       from download_entitlements
       where share_token = $1
       order by created_at, photo_id`,
      [shareToken]
    );
    return normalizePhotoIds(result.rows);
  }

  async function listDownloadEntitledPhotos(shareToken) {
    const result = await query(
      `select p.*
       from download_entitlements de
       join photos p on p.id = de.photo_id
       where de.share_token = $1
         and p.deleted_at is null
       order by de.created_at, p.created_at, p.id`,
      [shareToken]
    );
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function getDownloadEntitledPhoto(shareToken, photoId) {
    const result = await query(
      `select p.*
       from download_entitlements de
       join photos p on p.id = de.photo_id
       where de.share_token = $1
         and de.photo_id = $2
         and p.deleted_at is null
       limit 1`,
      [shareToken, photoId]
    );
    return rowToPhoto(result.rows[0], config);
  }

  return {
    createDownloadEntitlementsForSession,
    getDownloadEntitledPhoto,
    listDownloadEntitledPhotos,
    listDownloadEntitlementPhotoIds,
  };
}

module.exports = { createDownloadEntitlementRepo };
