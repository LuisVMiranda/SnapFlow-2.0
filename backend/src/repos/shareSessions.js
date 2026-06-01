const { rowToShare, toCents } = require('./mappers');

const SHARE_WITH_SALES_SQL = `
  select ss.*,
         coalesce(sales.sold_photo_count, 0)::int as sold_photo_count,
         coalesce(sales.sold_order_count, 0)::int as sold_order_count,
         coalesce(sales.sold_amount_cents, 0)::bigint as sold_amount_cents,
         sales.last_sold_at
  from share_sessions ss
  left join (
    select share_token,
           coalesce(sum(photo_count), 0)::int as sold_photo_count,
           count(*)::int as sold_order_count,
           coalesce(sum(amount_cents), 0)::bigint as sold_amount_cents,
           max(approved_at) as last_sold_at
    from sessions
    where status = 'approved' and share_token is not null
    group by share_token
  ) sales on sales.share_token = ss.token
`;

function normalizeCartPhotoIds(photoIds) {
  return (Array.isArray(photoIds) ? photoIds : [])
    .filter((photoId) => photoId !== null && photoId !== undefined)
    .map(String)
    .filter(Boolean);
}

function createShareSessionRepo({ attachPhotosToSession, cancelPendingSessionsForShare, query }) {
  async function createShareSession(share) {
    const result = await query(
      `insert into share_sessions
        (token, gallery_id, gallery_name, gallery_description, access_code_hash, access_code, phone, client_name, client_email, package_type, photo_count, subtotal_cents, discount_cents, total_cents, expires_at, retention_expires_at, link, photo_preset_ids, photo_preset_snapshot, photo_preset_applied_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       returning *`,
      [
        share.token,
        share.galleryId || share.token,
        share.galleryName || '',
        share.galleryDescription || '',
        share.accessCodeHash,
        share.accessCode || null,
        share.phone,
        share.clientName || '',
        share.clientEmail || '',
        share.packageType || 'eventos',
        share.photoCount,
        toCents(share.subtotal === undefined ? share.total : share.subtotal),
        toCents(share.discountAmount),
        toCents(share.total),
        share.expiresAt,
        share.retentionExpiresAt,
        share.link,
        share.photoPresetIds || [],
        JSON.stringify(share.photoPresetSnapshot || []),
        share.photoPresetAppliedAt || null,
      ]
    );
    await attachPhotosToSession(share.photoIds, {
      shareToken: share.token,
      retentionExpiresAt: share.retentionExpiresAt,
      replaceShareToken: true,
    });
    return rowToShare(result.rows[0], { includeSensitive: true });
  }

  async function findShareWithExactPhotos(photoIds) {
    if (!Array.isArray(photoIds) || photoIds.length === 0) return null;
    const uniquePhotoIds = [...new Set(photoIds.map(String).filter(Boolean))];
    if (!uniquePhotoIds.length) return null;

    const result = await query(
      `with selected_photos as (
         select unnest($1::text[]) as id
       ),
       selected_count as (
         select count(*)::int as total from selected_photos
       ),
       candidate_shares as (
         select p.share_token
         from photos p
         join selected_photos selected on selected.id = p.id
         where p.deleted_at is null
           and p.share_token is not null
         group by p.share_token
         having count(distinct p.id) = (select total from selected_count)
       )
       select ss.*
       from share_sessions ss
       join candidate_shares candidate on candidate.share_token = ss.token
       where not exists (
         select 1
         from photos p
         where p.share_token = ss.token
           and p.deleted_at is null
           and not exists (
             select 1 from selected_photos selected where selected.id = p.id
           )
       )
       order by
         case when ss.deleted_at is null then 0 else 1 end,
         ss.created_at desc
       limit 1`,
      [uniquePhotoIds]
    );
    return rowToShare(result.rows[0], { includeAccessCode: true, includeSensitive: true });
  }

  async function updateShareSession(token, updates = {}) {
    const hasExpiresAt = Boolean(updates.expiresAt);
    const result = await query(
      `update share_sessions
       set phone = coalesce($2, phone),
           client_name = coalesce($3, client_name),
           client_email = coalesce($4, client_email),
           package_type = coalesce($5, package_type),
           subtotal_cents = coalesce($6, subtotal_cents),
           discount_cents = coalesce($7, discount_cents),
           total_cents = coalesce($8, total_cents),
           expires_at = coalesce($9, expires_at),
           access_code_hash = coalesce($10, access_code_hash),
           access_code = coalesce($11, access_code),
           gallery_name = coalesce($12, gallery_name),
           gallery_description = coalesce($13, gallery_description),
           status = case when $14::boolean then 'active' else status end,
           revoked_at = case when $14::boolean then null else revoked_at end
       where token = $1 and deleted_at is null
       returning *`,
      [
        token,
        updates.phone ?? null,
        updates.clientName ?? null,
        updates.clientEmail ?? null,
        updates.packageType ?? null,
        updates.subtotal === undefined ? null : toCents(updates.subtotal),
        updates.discountAmount === undefined ? null : toCents(updates.discountAmount),
        updates.total === undefined ? null : toCents(updates.total),
        updates.expiresAt || null,
        updates.accessCodeHash || null,
        updates.accessCode || null,
        updates.galleryName ?? null,
        updates.galleryDescription ?? null,
        hasExpiresAt,
      ]
    );
    return rowToShare(result.rows[0], { includeAccessCode: true });
  }

  async function updateSharePresetState(token, updates = {}) {
    const result = await query(
      `update share_sessions
       set photo_preset_ids = coalesce($2, photo_preset_ids),
           photo_preset_snapshot = coalesce($3, photo_preset_snapshot),
           photo_preset_applied_at = $4,
           photo_preset_undo_snapshot = $5
       where token = $1 and deleted_at is null
       returning *`,
      [
        token,
        updates.photoPresetIds || null,
        updates.photoPresetSnapshot === undefined ? null : JSON.stringify(updates.photoPresetSnapshot || []),
        updates.photoPresetAppliedAt || null,
        updates.photoPresetUndoSnapshot === undefined || updates.photoPresetUndoSnapshot === null
          ? null
          : JSON.stringify(updates.photoPresetUndoSnapshot),
      ]
    );
    return rowToShare(result.rows[0], { includeAccessCode: true });
  }

  async function updateShareWatermarkState(token, updates = {}) {
    const nextAssetId = updates.watermarkAssetId || null;
    const result = await query(
      `update share_sessions
       set watermark_asset_id = $2,
           watermark_settings = coalesce($3, '{}'::jsonb),
           watermark_updated_at = coalesce($4, now())
       where token = $1
         and deleted_at is null
         and (
           $2::text is null
           or exists (
             select 1
             from watermark_assets
             where id = $2
               and deleted_at is null
           )
         )
       returning *`,
      [
        token,
        nextAssetId,
        updates.watermarkSettings === undefined ? null : JSON.stringify(updates.watermarkSettings || {}),
        updates.watermarkUpdatedAt || null,
      ]
    );
    return rowToShare(result.rows[0], { includeAccessCode: true });
  }

  async function updateShareOverlayState(token, updates = {}) {
    const nextAssetId = updates.overlayAssetId || null;
    const result = await query(
      `update share_sessions
       set overlay_asset_id = $2,
           overlay_enabled = coalesce($3, false),
           overlay_settings = coalesce($4, '{}'::jsonb),
           overlay_updated_at = coalesce($5, now())
       where token = $1
         and deleted_at is null
         and (
           $2::text is null
           or exists (
             select 1
             from overlay_assets
             where id = $2
               and deleted_at is null
           )
         )
       returning *`,
      [
        token,
        nextAssetId,
        updates.overlayEnabled === undefined ? null : Boolean(updates.overlayEnabled),
        updates.overlaySettings === undefined ? null : JSON.stringify(updates.overlaySettings || {}),
        updates.overlayUpdatedAt || null,
      ]
    );
    return rowToShare(result.rows[0], { includeAccessCode: true });
  }

  async function reactivateShareSession(token, updates = {}) {
    const result = await query(
      `update share_sessions
       set expires_at = $2,
           retention_expires_at = coalesce($3, retention_expires_at),
           access_code_hash = coalesce($4, access_code_hash),
           access_code = coalesce($5, access_code),
           link = coalesce(link, $6),
           status = 'active',
           revoked_at = null,
           photo_count = (
             select count(*)::int
             from photos
             where share_token = $1 and deleted_at is null
           )
       where token = $1 and deleted_at is null
       returning *`,
      [
        token,
        updates.expiresAt,
        updates.retentionExpiresAt || null,
        updates.accessCodeHash || null,
        updates.accessCode || null,
        updates.link || null,
      ]
    );
    return rowToShare(result.rows[0], { includeAccessCode: true, includeSensitive: true });
  }

  async function restoreShareSession(token, updates = {}) {
    const result = await query(
      `update share_sessions
       set phone = coalesce($2, phone),
           client_name = coalesce($3, client_name),
           client_email = coalesce($4, client_email),
           gallery_name = coalesce($5, gallery_name),
           gallery_description = coalesce($6, gallery_description),
           package_type = coalesce($7, package_type),
           subtotal_cents = coalesce($8, subtotal_cents),
           discount_cents = coalesce($9, discount_cents),
           total_cents = coalesce($10, total_cents),
           expires_at = coalesce($11, expires_at),
           retention_expires_at = coalesce($12, retention_expires_at),
           access_code_hash = coalesce($13, access_code_hash),
           access_code = coalesce($14, access_code),
           link = coalesce($15, link),
           status = 'active',
           revoked_at = null,
           deleted_at = null,
           photo_count = (
             select count(*)::int
             from photos
             where share_token = $1 and deleted_at is null
           )
       where token = $1
       returning *`,
      [
        token,
        updates.phone ?? null,
        updates.clientName ?? null,
        updates.clientEmail ?? null,
        updates.galleryName ?? null,
        updates.galleryDescription ?? null,
        updates.packageType ?? null,
        updates.subtotal === undefined ? null : toCents(updates.subtotal),
        updates.discountAmount === undefined ? null : toCents(updates.discountAmount),
        updates.total === undefined ? null : toCents(updates.total),
        updates.expiresAt || null,
        updates.retentionExpiresAt || null,
        updates.accessCodeHash || null,
        updates.accessCode || null,
        updates.link || null,
      ]
    );
    return rowToShare(result.rows[0], { includeAccessCode: true, includeSensitive: true });
  }

  async function refreshSharePhotoCount(token) {
    const result = await query(
      `update share_sessions
       set photo_count = (
         select count(*)::int
         from photos
         where share_token = $1 and deleted_at is null
       )
       where token = $1 and deleted_at is null
       returning *`,
      [token]
    );
    return rowToShare(result.rows[0], { includeAccessCode: true });
  }

  async function findShareWithMatchingMetadata(share) {
    if (!share.accessCode) return null;
    const result = await query(
      `select ss.*
       from share_sessions ss
       join photos p on p.share_token = ss.token and p.deleted_at is null
       where ss.deleted_at is null
         and ss.token <> $1
         and coalesce(ss.access_code, '') = $2
         and ss.phone = $3
         and ss.package_type = $4
         and ss.client_name = $5
         and ss.client_email = $6
       group by ss.token
       order by ss.created_at desc
       limit 1`,
      [share.token, share.accessCode, share.phone, share.packageType, share.clientName || '', share.clientEmail || '']
    );
    return rowToShare(result.rows[0], { includeAccessCode: true, includeSensitive: true });
  }

  async function deleteDetachedShareDuplicates(share) {
    if (!share.accessCode) return [];
    const result = await query(
      `update share_sessions ss
       set deleted_at = coalesce(deleted_at, now())
       where ss.deleted_at is null
         and ss.token <> $1
         and coalesce(ss.access_code, '') = $2
         and ss.phone = $3
         and ss.package_type = $4
         and ss.client_name = $5
         and ss.client_email = $6
         and not exists (
           select 1 from photos p
           where p.share_token = ss.token and p.deleted_at is null
         )
       returning *`,
      [share.token, share.accessCode, share.phone, share.packageType, share.clientName || '', share.clientEmail || '']
    );
    return result.rows.map((row) => rowToShare(row, { includeAccessCode: true }));
  }

  async function getShareSession(token, options = {}) {
    const result = await query(
      `${SHARE_WITH_SALES_SQL}
       where (ss.token = $1 or lower(ss.token) = lower($1))
         and ss.deleted_at is null
       order by case when ss.token = $1 then 0 else 1 end, ss.created_at desc
       limit 1`,
      [token]
    );
    return rowToShare(result.rows[0], options);
  }

  async function markShareAccessGranted(token) {
    const result = await query('update share_sessions set access_granted_at = coalesce(access_granted_at, now()) where token = $1 returning *', [token]);
    return rowToShare(result.rows[0]);
  }

  async function getShareCart(token) {
    const result = await query('select photo_ids from share_carts where share_token = $1', [token]);
    return normalizeCartPhotoIds(result.rows[0]?.photo_ids);
  }

  async function saveShareCart(token, photoIds = []) {
    const uniquePhotoIds = [...new Set(normalizeCartPhotoIds(photoIds))];
    const result = await query(
      `insert into share_carts (share_token, photo_ids, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (share_token)
       do update set photo_ids = excluded.photo_ids, updated_at = now()
       returning photo_ids`,
      [token, JSON.stringify(uniquePhotoIds)]
    );
    return normalizeCartPhotoIds(result.rows[0]?.photo_ids);
  }

  async function extendShareSession(token, minutes) {
    const result = await query(
      `update share_sessions
       set expires_at = greatest(expires_at, now()) + ($2::int * interval '1 minute'),
           revoked_at = null,
           status = 'active',
           extends_count = extends_count + 1
       where token = $1 and deleted_at is null returning *`,
      [token, minutes]
    );
    return rowToShare(result.rows[0]);
  }

  async function revokeShareSession(token) {
    const result = await query("update share_sessions set status = 'revoked', revoked_at = coalesce(revoked_at, now()) where token = $1 and deleted_at is null returning *", [token]);
    return rowToShare(result.rows[0]);
  }

  async function deleteShareSession(token) {
    const result = await query('update share_sessions set deleted_at = coalesce(deleted_at, now()) where token = $1 and deleted_at is null returning *', [token]);
    const deleted = rowToShare(result.rows[0]);
    if (deleted && typeof cancelPendingSessionsForShare === 'function') {
      await cancelPendingSessionsForShare(token, 'Galeria removida pelo administrador.');
    }
    return deleted;
  }

  return {
    createShareSession,
    deleteShareSession,
    deleteDetachedShareDuplicates,
    extendShareSession,
    findShareWithExactPhotos,
    findShareWithMatchingMetadata,
    getShareCart,
    getShareSession,
    markShareAccessGranted,
    reactivateShareSession,
    refreshSharePhotoCount,
    restoreShareSession,
    revokeShareSession,
    saveShareCart,
    updateShareSession,
    updateShareOverlayState,
    updateSharePresetState,
    updateShareWatermarkState,
  };
}

module.exports = { createShareSessionRepo };
