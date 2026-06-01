const { rowToOverlayAsset } = require('./mappers');

function createOverlayAssetRepo({ query }) {
  async function listOverlayAssets() {
    const result = await query(
      `select *
       from overlay_assets
       where deleted_at is null
       order by created_at desc, identifier asc`
    );
    return result.rows.map(rowToOverlayAsset);
  }

  async function getOverlayAsset(id) {
    const result = await query(
      'select * from overlay_assets where id = $1 and deleted_at is null',
      [id]
    );
    return rowToOverlayAsset(result.rows[0]);
  }

  async function createOverlayAsset(asset) {
    const result = await query(
      `insert into overlay_assets
        (id, identifier, original_filename, storage_path, mime_type, width, height, size_bytes, checksum)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [
        asset.id,
        asset.identifier,
        asset.originalFilename || '',
        asset.storagePath,
        asset.mimeType || 'image/png',
        asset.width || 0,
        asset.height || 0,
        asset.sizeBytes || 0,
        asset.checksum || '',
      ]
    );
    return rowToOverlayAsset(result.rows[0]);
  }

  async function updateOverlayAsset(id, updates = {}) {
    const result = await query(
      `update overlay_assets
       set identifier = coalesce($2, identifier),
           updated_at = now()
       where id = $1 and deleted_at is null
       returning *`,
      [id, updates.identifier ?? null]
    );
    return rowToOverlayAsset(result.rows[0]);
  }

  async function countOverlayAssetAssignments(id) {
    const result = await query(
      `select count(*)::int as count
       from share_sessions
       where overlay_asset_id = $1 and deleted_at is null`,
      [id]
    );
    return Number(result.rows[0]?.count || 0);
  }

  async function deleteOverlayAsset(id) {
    const result = await query(
      `update overlay_assets
       set deleted_at = coalesce(deleted_at, now()),
           updated_at = now()
       where id = $1
         and deleted_at is null
         and not exists (
           select 1
           from share_sessions
           where overlay_asset_id = $1
             and deleted_at is null
         )
       returning *`,
      [id]
    );
    return rowToOverlayAsset(result.rows[0]);
  }

  return {
    countOverlayAssetAssignments,
    createOverlayAsset,
    deleteOverlayAsset,
    getOverlayAsset,
    listOverlayAssets,
    updateOverlayAsset,
  };
}

module.exports = { createOverlayAssetRepo };
