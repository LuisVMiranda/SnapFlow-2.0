const { HttpError } = require('../errors');
const { randomToken } = require('../tokens');

function normalizeWatermarkAssetName(value, fallback = "Marca d'água") {
  const normalized = String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return normalized || fallback;
}

function watermarkAssetPayload(asset) {
  if (!asset) return null;
  return {
    id: asset.id,
    name: asset.name,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes,
    checksum: asset.checksum,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    url: `/api/admin/watermark-assets/${asset.id}/file`,
  };
}

function createWatermarkAssetService({ media, repos }) {
  async function listAssets() {
    if (typeof repos.listWatermarkAssets !== 'function') return [];
    const assets = await repos.listWatermarkAssets();
    return assets.map(watermarkAssetPayload);
  }

  async function getAsset(id) {
    if (!id || typeof repos.getWatermarkAsset !== 'function') return null;
    return repos.getWatermarkAsset(id);
  }

  async function createAsset(file, body = {}) {
    if (!file) {
      throw new HttpError(400, "Envie uma imagem para criar a marca d'água.", 'watermark_asset_required');
    }
    if (!media || typeof media.processWatermarkAssetUpload !== 'function') {
      throw new HttpError(500, "Processamento de marca d'água indisponível.", 'watermark_asset_processing_unavailable');
    }
    const processed = await media.processWatermarkAssetUpload(file);
    const fallbackName = String(body.name || file.originalname || `Marca ${randomToken(4)}`).replace(/\.[^.]+$/, '');
    try {
      const asset = await repos.createWatermarkAsset({
        ...processed,
        name: normalizeWatermarkAssetName(body.name, fallbackName),
      });
      return watermarkAssetPayload(asset);
    } catch (error) {
      await media.removeWatermarkAsset(processed).catch(() => {});
      throw error;
    }
  }

  async function updateAsset(id, updates = {}) {
    const existing = await getAsset(id);
    if (!existing) throw new HttpError(404, "Marca d'água não encontrada.", 'watermark_asset_not_found');
    const updated = await repos.updateWatermarkAsset(id, {
      name: normalizeWatermarkAssetName(updates.name, existing.name),
    });
    return watermarkAssetPayload(updated);
  }

  async function deleteAsset(id) {
    const existing = await getAsset(id);
    if (!existing) throw new HttpError(404, "Marca d'água não encontrada.", 'watermark_asset_not_found');
    const assignmentCount = typeof repos.countWatermarkAssetAssignments === 'function'
      ? await repos.countWatermarkAssetAssignments(id)
      : 0;
    if (assignmentCount > 0) {
      throw new HttpError(
        409,
        "Esta marca d'água está vinculada a uma ou mais galerias. Remova o vínculo antes de deletar.",
        'watermark_asset_in_use',
        { assignmentCount }
      );
    }
    const deleted = await repos.deleteWatermarkAsset(id);
    if (!deleted) {
      const currentAssignmentCount = typeof repos.countWatermarkAssetAssignments === 'function'
        ? await repos.countWatermarkAssetAssignments(id)
        : 0;
      if (currentAssignmentCount > 0) {
        throw new HttpError(
          409,
          "Esta marca d'água está vinculada a uma ou mais galerias. Remova o vínculo antes de deletar.",
          'watermark_asset_in_use',
          { assignmentCount: currentAssignmentCount }
        );
      }
      throw new HttpError(404, "Marca d'água não encontrada.", 'watermark_asset_not_found');
    }
    await media.removeWatermarkAsset(existing).catch(() => {});
    return watermarkAssetPayload(deleted);
  }

  return {
    createAsset,
    deleteAsset,
    getAsset,
    listAssets,
    updateAsset,
  };
}

module.exports = {
  createWatermarkAssetService,
  normalizeWatermarkAssetName,
  watermarkAssetPayload,
};
