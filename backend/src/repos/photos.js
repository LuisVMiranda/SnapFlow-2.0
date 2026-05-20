const { rowToPhoto } = require('./mappers');
const { buildPhotoPage, decodePhotoCursor, normalizePhotoPageLimit } = require('../services/photoPagination');

function createPhotoRepo({ config, pool, query, withTransaction }) {
  async function createPhotos(photos) {
    const saved = [];
    await withTransaction(pool, async (client) => {
      for (const photo of photos) {
        const result = await client.query(
          `insert into photos
            (id, session_id, share_token, source_path, original_path, thumb_path, preview_path, mime_type, size_bytes, checksum, retention_expires_at, applied_preset_ids, applied_preset_snapshot, preset_applied_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           returning *`,
          [
            photo.id,
            photo.sessionId || null,
            photo.shareToken || null,
            photo.sourcePath || photo.originalPath,
            photo.originalPath,
            photo.thumbPath,
            photo.previewPath,
            photo.mimeType,
            photo.sizeBytes,
            photo.checksum,
            photo.retentionExpiresAt || null,
            photo.appliedPresetIds || [],
            JSON.stringify(photo.appliedPresetSnapshot || []),
            photo.presetAppliedAt || null,
          ]
        );
        saved.push(rowToPhoto(result.rows[0], config));
      }
    });
    return saved;
  }

  async function attachPhotosToSession(photoIds, values) {
    if (!Array.isArray(photoIds) || photoIds.length === 0) return [];
    const replaceShareToken = Boolean(values.replaceShareToken && values.shareToken);
    const result = await query(
      `update photos
       set session_id = coalesce($1, session_id),
           share_token = case
             when $4::boolean then $2
             else coalesce($2, share_token)
           end,
           retention_expires_at = coalesce($3, retention_expires_at)
       where id = any($5::text[])
       returning *`,
      [values.sessionId || null, values.shareToken || null, values.retentionExpiresAt || null, replaceShareToken, photoIds]
    );
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function listPhotosByIds(photoIds) {
    if (!Array.isArray(photoIds) || photoIds.length === 0) return [];
    const result = await query('select * from photos where id = any($1::text[]) and deleted_at is null', [photoIds]);
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function listPhotosForShareByIds(shareToken, photoIds) {
    if (!Array.isArray(photoIds) || photoIds.length === 0) return [];
    const result = await query(
      `select *
       from photos
       where share_token = $1
         and id = any($2::text[])
         and deleted_at is null`,
      [shareToken, photoIds]
    );
    const byId = new Map(result.rows.map((row) => [row.id, rowToPhoto(row, config)]));
    return photoIds.map((photoId) => byId.get(photoId)).filter(Boolean);
  }

  async function listPhotosForShare(shareToken) {
    const result = await query('select * from photos where share_token = $1 and deleted_at is null order by created_at', [shareToken]);
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function countPhotosForShare(shareToken) {
    const result = await query('select count(*)::int as count from photos where share_token = $1 and deleted_at is null', [shareToken]);
    return Number(result.rows[0].count || 0);
  }

  async function listPhotosForSharePage(shareToken, options = {}) {
    const limit = normalizePhotoPageLimit(options.limit);
    const cursor = decodePhotoCursor(options.cursor);
    const params = [shareToken, limit + 1];
    let cursorSql = '';

    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      cursorSql = `and (
        created_at > $3::timestamptz
        or (created_at = $3::timestamptz and id > $4::text)
      )`;
    }

    const [photosResult, countResult] = await Promise.all([
      query(
        `select *
         from photos
         where share_token = $1
           and deleted_at is null
           ${cursorSql}
         order by created_at, id
         limit $2`,
        params
      ),
      query('select count(*)::int as count from photos where share_token = $1 and deleted_at is null', [shareToken]),
    ]);

    const photos = photosResult.rows.map((row) => rowToPhoto(row, config));
    return buildPhotoPage(photos, limit, countResult.rows[0].count || 0);
  }

  async function deletePhotoFromShare(shareToken, photoId) {
    const result = await query(
      `update photos
       set deleted_at = coalesce(deleted_at, now())
       where share_token = $1 and id = $2 and deleted_at is null
       returning *`,
      [shareToken, photoId]
    );
    return rowToPhoto(result.rows[0], config);
  }

  async function updatePhotoPresetState(photoId, updates = {}) {
    const result = await query(
      `update photos
       set original_path = coalesce($2, original_path),
           thumb_path = coalesce($3, thumb_path),
           preview_path = coalesce($4, preview_path),
           applied_preset_ids = coalesce($5, applied_preset_ids),
           applied_preset_snapshot = coalesce($6, applied_preset_snapshot),
           preset_applied_at = $7,
           undo_original_path = $8,
           undo_thumb_path = $9,
           undo_preview_path = $10,
           undo_preset_snapshot = $11
       where id = $1 and deleted_at is null
       returning *`,
      [
        photoId,
        updates.originalPath || null,
        updates.thumbPath || null,
        updates.previewPath || null,
        updates.appliedPresetIds || null,
        updates.appliedPresetSnapshot === undefined ? null : JSON.stringify(updates.appliedPresetSnapshot || []),
        updates.presetAppliedAt || null,
        updates.undoOriginalPath ?? null,
        updates.undoThumbPath ?? null,
        updates.undoPreviewPath ?? null,
        updates.undoPresetSnapshot === undefined || updates.undoPresetSnapshot === null
          ? null
          : JSON.stringify(updates.undoPresetSnapshot),
      ]
    );
    return rowToPhoto(result.rows[0], config);
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
    countPhotosForShare,
    createPhotos,
    deletePhotoFromShare,
    getPhoto,
    listPhotosByIds,
    listPhotosForShareByIds,
    listPhotosForSharePage,
    listPhotosForSession,
    listPhotosForShare,
    updatePhotoPresetState,
  };
}

module.exports = { createPhotoRepo };
