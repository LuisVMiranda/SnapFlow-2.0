const { HttpError } = require('../errors');
const { randomToken } = require('../tokens');

function normalizeOverlayIdentifier(value, fallback = 'Overlay') {
  const normalized = String(value || fallback)
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (!normalized) {
    throw new HttpError(400, 'Informe um identificador para o overlay.', 'overlay_identifier_required');
  }
  return normalized;
}

function overlayAssetPayload(asset) {
  if (!asset) return null;
  return {
    id: asset.id,
    identifier: asset.identifier,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes,
    checksum: asset.checksum,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    url: `/api/admin/overlay-assets/${asset.id}/file`,
  };
}

function conflictError(assignmentCount) {
  return new HttpError(
    409,
    'Este overlay está vinculado a uma ou mais galerias. Remova o vínculo antes de deletar.',
    'overlay_asset_in_use',
    { assignmentCount }
  );
}

function createOverlayAssetService({ media, repos }) {
  async function listAssets() {
    if (typeof repos.listOverlayAssets !== 'function') return [];
    return (await repos.listOverlayAssets()).map(overlayAssetPayload);
  }

  async function getAsset(id) {
    if (!id || typeof repos.getOverlayAsset !== 'function') return null;
    return repos.getOverlayAsset(id);
  }

  async function createAsset(file, body = {}) {
    if (!media || typeof media.processOverlayAssetUpload !== 'function') {
      throw new HttpError(500, 'Processamento de overlay indisponível.', 'overlay_asset_processing_unavailable');
    }
    const processed = await media.processOverlayAssetUpload(file);
    const fallback = String(body.identifier || file.originalname || `Overlay ${randomToken(4)}`).replace(/\.[^.]+$/, '');
    try {
      const asset = await repos.createOverlayAsset({
        ...processed,
        identifier: normalizeOverlayIdentifier(body.identifier, fallback),
      });
      return overlayAssetPayload(asset);
    } catch (error) {
      await media.removeOverlayAsset(processed).catch(() => {});
      if (error.code === '23505') {
        throw new HttpError(409, 'Já existe um overlay ativo com este identificador.', 'overlay_identifier_conflict');
      }
      throw error;
    }
  }

  async function updateAsset(id, updates = {}) {
    const existing = await getAsset(id);
    if (!existing) throw new HttpError(404, 'Overlay não encontrado.', 'overlay_asset_not_found');
    try {
      const updated = await repos.updateOverlayAsset(id, {
        identifier: normalizeOverlayIdentifier(updates.identifier, existing.identifier),
      });
      return overlayAssetPayload(updated);
    } catch (error) {
      if (error.code === '23505') {
        throw new HttpError(409, 'Já existe um overlay ativo com este identificador.', 'overlay_identifier_conflict');
      }
      throw error;
    }
  }

  async function deleteAsset(id) {
    const existing = await getAsset(id);
    if (!existing) throw new HttpError(404, 'Overlay não encontrado.', 'overlay_asset_not_found');
    const assignmentCount = typeof repos.countOverlayAssetAssignments === 'function'
      ? await repos.countOverlayAssetAssignments(id)
      : 0;
    if (assignmentCount > 0) throw conflictError(assignmentCount);
    const deleted = await repos.deleteOverlayAsset(id);
    if (!deleted) {
      const currentCount = typeof repos.countOverlayAssetAssignments === 'function'
        ? await repos.countOverlayAssetAssignments(id)
        : 0;
      if (currentCount > 0) throw conflictError(currentCount);
      throw new HttpError(404, 'Overlay não encontrado.', 'overlay_asset_not_found');
    }
    await media.removeOverlayAsset(existing).catch(() => {});
    return overlayAssetPayload(deleted);
  }

  return { createAsset, deleteAsset, getAsset, listAssets, updateAsset };
}

module.exports = {
  createOverlayAssetService,
  normalizeOverlayIdentifier,
  overlayAssetPayload,
};
