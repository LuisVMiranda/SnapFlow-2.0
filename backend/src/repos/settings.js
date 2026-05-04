const { rowToPhoto } = require('./mappers');

function createSettingsRepo({ config, pool, query, withTransaction }) {
  async function getSettings() {
    const result = await query('select key, value from app_settings');
    return Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  }

  async function upsertSettings(settings) {
    await withTransaction(pool, async (client) => {
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          `insert into app_settings (key, value) values ($1, $2)
           on conflict (key) do update set value = excluded.value, updated_at = now()`,
          [key, JSON.stringify(value)]
        );
      }
    });
    return getSettings();
  }

  async function listCleanupEligible(now = new Date()) {
    const result = await query(
      `select * from photos
       where deleted_at is null
         and retention_expires_at is not null
         and retention_expires_at <= $1
         and not exists (
           select 1 from share_sessions ss
           where ss.token = photos.share_token
             and ss.revoked_at is null
             and ss.expires_at > now()
         )
       order by retention_expires_at
       limit 1000`,
      [now]
    );
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function markPhotosDeleted(photoIds) {
    if (!photoIds.length) return [];
    const result = await query('update photos set deleted_at = coalesce(deleted_at, now()) where id = any($1::text[]) returning *', [photoIds]);
    return result.rows.map((row) => rowToPhoto(row, config));
  }

  async function recordCleanupRun(run) {
    const result = await query(
      'insert into cleanup_runs (mode, files_count, bytes_count, errors) values ($1,$2,$3,$4) returning *',
      [run.mode, run.filesCount, run.bytesCount, run.errors || []]
    );
    return result.rows[0];
  }

  return {
    getSettings,
    listCleanupEligible,
    markPhotosDeleted,
    recordCleanupRun,
    upsertSettings,
  };
}

module.exports = { createSettingsRepo };
