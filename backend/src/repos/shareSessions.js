const { rowToShare, toCents } = require('./mappers');

function createShareSessionRepo({ attachPhotosToSession, query }) {
  async function createShareSession(share) {
    const result = await query(
      `insert into share_sessions
        (token, access_code_hash, access_code, phone, package_type, photo_count, total_cents, expires_at, retention_expires_at, link)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning *`,
      [
        share.token,
        share.accessCodeHash,
        share.accessCode || null,
        share.phone,
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
           package_type = coalesce($3, package_type),
           total_cents = coalesce($4, total_cents),
           expires_at = coalesce($5, expires_at),
           access_code_hash = coalesce($6, access_code_hash),
           access_code = coalesce($7, access_code),
           status = case when $8::boolean then 'active' else status end,
           revoked_at = case when $8::boolean then null else revoked_at end
       where token = $1 and deleted_at is null
       returning *`,
      [
        token,
        updates.phone ?? null,
        updates.packageType ?? null,
        updates.total === undefined ? null : toCents(updates.total),
        updates.expiresAt || null,
        updates.accessCodeHash || null,
        updates.accessCode || null,
        hasExpiresAt,
      ]
    );
    return rowToShare(result.rows[0], { includeAccessCode: true });
  }

  async function getShareSession(token, options = {}) {
    const result = await query('select * from share_sessions where token = $1 and deleted_at is null', [token]);
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
    extendShareSession,
    getShareSession,
    markShareAccessGranted,
    revokeShareSession,
    updateShareSession,
  };
}

module.exports = { createShareSessionRepo };
