const { rowToPhoto } = require('./mappers');

function createPhotoRepo({ config, pool, query, withTransaction }) {
  async function createPhotos(photos) {
    const saved = [];
    await withTransaction(pool, async (client) => {
      for (const photo of photos) {
        const result = await client.query(
          `insert into photos
            (id, session_id, share_token, original_path, thumb_path, preview_path, mime_type, size_bytes, checksum, retention_expires_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           returning *`,
          [
            photo.id,
            photo.sessionId || null,
            photo.shareToken || null,
            photo.originalPath,
            photo.thumbPath,
            photo.previewPath,
            photo.mimeType,
            photo.sizeBytes,
            photo.checksum,
            photo.retentionExpiresAt || null,
          ]
        );
        saved.push(rowToPhoto(result.rows[0], config));
      }
    });
    return saved;
  }

  async function attachPhotosToSession(photoIds, values) {
    if (!Array.isArray(photoIds) || photoIds.length === 0) return [];
    const result = await query(
      `update photos
       set session_id = coalesce($1, session_id),
           share_token = coalesce($2, share_token),
           retention_expires_at = coalesce($3, retention_expires_at)
       where id = any($4::text[])
       returning *`,
      [values.sessionId || null, values.shareToken || null, values.retentionExpiresAt || null, photoIds]
    );
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function listPhotosByIds(photoIds) {
    if (!Array.isArray(photoIds) || photoIds.length === 0) return [];
    const result = await query('select * from photos where id = any($1::text[]) and deleted_at is null', [photoIds]);
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function listPhotosForShare(shareToken) {
    const result = await query('select * from photos where share_token = $1 and deleted_at is null order by created_at', [shareToken]);
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function listPhotosForSession(sessionId) {
    const result = await query('select * from photos where session_id = $1 and deleted_at is null order by created_at', [sessionId]);
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function getPhoto(photoId) {
    const result = await query('select * from photos where id = $1 and deleted_at is null', [photoId]);
    return rowToPhoto(result.rows[0], config);
  }

  return {
    attachPhotosToSession,
    createPhotos,
    getPhoto,
    listPhotosByIds,
    listPhotosForSession,
    listPhotosForShare,
  };
}

module.exports = { createPhotoRepo };
