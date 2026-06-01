const { rowToWatermarkAsset } = require('./mappers');

function createWatermarkAssetRepo({ query }) {
  async function listWatermarkAssets() {
    const result = await query(
      `select *
       from watermark_assets
       where deleted_at is null
       order by created_at desc, name asc`
    );
    return result.rows.map(rowToWatermarkAsset);
  }

  async function getWatermarkAsset(id) {
    const result = await query(
      'select * from watermark_assets where id = $1 and deleted_at is null',
      [id]
    );
    return rowToWatermarkAsset(result.rows[0]);
  }

  async function createWatermarkAsset(asset) {
    const result = await query(
      `insert into watermark_assets
        (id, name, original_filename, storage_path, mime_type, width, height, size_bytes, checksum)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [
        asset.id,
        asset.name,
        asset.originalFilename || '',
        asset.storagePath,
        asset.mimeType || 'image/png',
        asset.width || 0,
        asset.height || 0,
        asset.sizeBytes || 0,
        asset.checksum || '',
      ]
    );
    return rowToWatermarkAsset(result.rows[0]);
  }

  async function updateWatermarkAsset(id, updates = {}) {
    const result = await query(
      `update watermark_assets
       set name = coalesce($2, name),
           updated_at = now()
       where id = $1 and deleted_at is null
       returning *`,
      [id, updates.name ?? null]
    );
    return rowToWatermarkAsset(result.rows[0]);
  }

  async function countWatermarkAssetAssignments(id) {
    const result = await query(
      `select count(*)::int as count
       from share_sessions
       where watermark_asset_id = $1 and deleted_at is null`,
      [id]
    );
    return Number(result.rows[0]?.count || 0);
  }

  async function deleteWatermarkAsset(id) {
    const result = await query(
      `update watermark_assets
       set deleted_at = coalesce(deleted_at, now()),
           updated_at = now()
       where id = $1
         and deleted_at is null
         and not exists (
           select 1
           from share_sessions
           where watermark_asset_id = $1
             and deleted_at is null
         )
       returning *`,
      [id]
    );
    return rowToWatermarkAsset(result.rows[0]);
  }

  return {
    countWatermarkAssetAssignments,
    createWatermarkAsset,
    deleteWatermarkAsset,
    getWatermarkAsset,
    listWatermarkAssets,
    updateWatermarkAsset,
  };
}

module.exports = { createWatermarkAssetRepo };
