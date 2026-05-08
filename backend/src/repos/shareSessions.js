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

function createShareSessionRepo({ attachPhotosToSession, query }) {
  async function createShareSession(share) {
    const result = await query(
      `insert into share_sessions
        (token, gallery_id, gallery_name, gallery_description, access_code_hash, access_code, phone, client_name, client_email, package_type, photo_count, total_cents, expires_at, retention_expires_at, link)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
        toCents(share.total),
        share.expiresAt,
        share.retentionExpiresAt,
        share.link,
      ]
    );
    await attachPhotosToSession(share.photoIds, { shareToken: share.token, retentionExpiresAt: share.retentionExpiresAt });
    return rowToShare(result.rows[0], { includeSensitive: true });
  }

  async function updateShareSession(token, updates = {}) {
    const hasExpiresAt = Boolean(updates.expiresAt);
    const result = await query(
      `update share_sessions
       set phone = coalesce($2, phone),
           client_name = coalesce($3, client_name),
           client_email = coalesce($4, client_email),
           package_type = coalesce($5, package_type),
           total_cents = coalesce($6, total_cents),
           expires_at = coalesce($7, expires_at),
           access_code_hash = coalesce($8, access_code_hash),
           access_code = coalesce($9, access_code),
           gallery_name = coalesce($10, gallery_name),
           gallery_description = coalesce($11, gallery_description),
           status = case when $12::boolean then 'active' else status end,
           revoked_at = case when $12::boolean then null else revoked_at end
       where token = $1 and deleted_at is null
       returning *`,
      [
        token,
        updates.phone ?? null,
        updates.clientName ?? null,
        updates.clientEmail ?? null,
        updates.packageType ?? null,
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
    if (!share?.accessCode) return null;
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
    if (!share?.accessCode) return [];
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
    const result = await query(`${SHARE_WITH_SALES_SQL} where ss.token = $1 and ss.deleted_at is null`, [token]);
    return rowToShare(result.rows[0], options);
  }

  async function markShareAccessGranted(token) {
    const result = await query('update share_sessions set access_granted_at = coalesce(access_granted_at, now()) where token = $1 returning *', [token]);
    return rowToShare(result.rows[0]);
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
    return rowToShare(result.rows[0]);
  }

  return {
    createShareSession,
    deleteShareSession,
    deleteDetachedShareDuplicates,
    extendShareSession,
    findShareWithMatchingMetadata,
    getShareSession,
    markShareAccessGranted,
    reactivateShareSession,
    refreshSharePhotoCount,
    revokeShareSession,
    updateShareSession,
  };
}

module.exports = { createShareSessionRepo };
