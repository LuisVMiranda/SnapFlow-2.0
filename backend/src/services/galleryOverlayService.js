const { HttpError } = require('../errors');
const { overlayAssetPayload } = require('./overlayAssetService');
const { normalizeOverlaySettings } = require('./overlaySettingsService');
const { normalizeWatermarkSettings } = require('./watermarkSettingsService');
const { createKeyedAsyncQueue } = require('./galleryWatermarkService');

function hasOverlayAsset(share) {
  return Boolean(share?.overlayAssetId);
}

function clientOverlayPayload(effective, accessToken = '') {
  if (!effective || effective.kind !== 'image' || !effective.enabled) return { enabled: false };
  const params = new URLSearchParams();
  if (accessToken) params.set('access_token', accessToken);
  const query = params.toString();
  return {
    enabled: true,
    kind: 'image',
    assetId: effective.asset.id,
    identifier: effective.asset.identifier,
    assetUrl: `/api/share-session/${effective.share.token}/overlay/${effective.asset.id}${query ? `?${query}` : ''}`,
    ...effective.settings,
  };
}

async function mapWithSmallConcurrency(items, concurrency, mapper) {
  const results = [];
  const limit = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  for (let index = 0; index < items.length; index += limit) {
    const chunk = items.slice(index, index + limit);
    const settled = await Promise.allSettled(chunk.map((item, offset) => mapper(item, index + offset)));
    const rejected = settled.find((result) => result.status === 'rejected');
    if (rejected) throw rejected.reason;
    results.push(...settled.map((result) => result.value));
  }
  return results;
}

function createGalleryOverlayService({ media, repos, watermarkSettings }) {
  const runShareOverlayJob = createKeyedAsyncQueue();

  async function defaultWatermarkSettings() {
    if (watermarkSettings && typeof watermarkSettings.getSettings === 'function') {
      return normalizeWatermarkSettings(await watermarkSettings.getSettings());
    }
    return normalizeWatermarkSettings();
  }

  async function getShareOrFail(token) {
    const share = await repos.getShareSession(token, { includeAccessCode: true });
    if (!share) {
      throw new HttpError(404, 'Galeria não encontrada. Atualize Galerias e confirme se o link ainda existe.', 'share_not_found');
    }
    return share;
  }

  async function effectiveForShare(shareOrToken) {
    const share = typeof shareOrToken === 'string' ? await getShareOrFail(shareOrToken) : shareOrToken;
    const settings = normalizeOverlaySettings(share?.overlaySettings || {});
    if (!hasOverlayAsset(share) || !share.overlayEnabled || typeof repos.getOverlayAsset !== 'function') {
      return { enabled: false, kind: 'none', settings, share };
    }
    const asset = await repos.getOverlayAsset(share.overlayAssetId);
    if (!asset) return { enabled: false, kind: 'none', settings, share };
    return { enabled: true, kind: 'image', asset, assetPath: asset.storagePath, settings, share };
  }

  async function watermarkForShare(share) {
    const settings = Object.keys(share?.watermarkSettings || {}).length
      ? normalizeWatermarkSettings(share.watermarkSettings)
      : await defaultWatermarkSettings();
    if (!share?.watermarkAssetId || typeof repos.getWatermarkAsset !== 'function') {
      return { kind: 'default', settings, share };
    }
    const asset = await repos.getWatermarkAsset(share.watermarkAssetId);
    if (!asset) return { kind: 'default', settings, share };
    return { kind: 'image', asset, assetPath: asset.storagePath, settings, share };
  }

  async function reprocessSharePreviews(share, overlay) {
    if (!media || typeof media.reprocessPhotoOverlay !== 'function' || typeof repos.listPhotosForShare !== 'function') {
      return [];
    }
    const watermark = await watermarkForShare(share);
    const photos = await repos.listPhotosForShare(share.token);
    return mapWithSmallConcurrency(photos, 2, async (photo) => {
      const processed = await media.reprocessPhotoOverlay(photo, overlay, { watermark });
      return repos.updatePhotoOverlayState(photo.id, processed);
    });
  }

  function resolveNextState(share, payload) {
    const assetId = payload.assetId === undefined ? share.overlayAssetId : String(payload.assetId || '').trim();
    if (!assetId) throw new HttpError(400, 'Selecione um overlay para aplicar nesta galeria.', 'overlay_asset_required');
    const enabled = payload.enabled === undefined ? true : Boolean(payload.enabled);
    const settings = normalizeOverlaySettings(payload.settings || share.overlaySettings || {});
    return { assetId, enabled, settings };
  }

  async function assignToShareNow(token, payload = {}) {
    const share = await getShareOrFail(token);
    const next = resolveNextState(share, payload);
    const asset = await repos.getOverlayAsset(next.assetId);
    if (!asset) throw new HttpError(404, 'Overlay não encontrado.', 'overlay_asset_not_found');
    const updated = await repos.updateShareOverlayState(share.token, {
      overlayAssetId: asset.id,
      overlayEnabled: next.enabled,
      overlaySettings: next.settings,
      overlayUpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new HttpError(409, 'Este overlay não está mais disponível. Atualize a biblioteca e tente novamente.', 'overlay_asset_conflict');
    }
    const effective = await effectiveForShare(updated);
    const photos = await reprocessSharePreviews(updated, effective);
    return {
      share: updated,
      changedPhotoCount: photos.length,
      overlaySettings: clientOverlayPayload(effective),
      overlayAsset: overlayAssetPayload(asset),
    };
  }

  async function clearFromShareNow(token) {
    const share = await getShareOrFail(token);
    const updated = await repos.updateShareOverlayState(share.token, {
      overlayAssetId: null,
      overlayEnabled: false,
      overlaySettings: {},
      overlayUpdatedAt: new Date().toISOString(),
    });
    if (!updated) throw new HttpError(404, 'Galeria não encontrada. Atualize Galerias e confirme se o link ainda existe.', 'share_not_found');
    const effective = await effectiveForShare(updated);
    const photos = await reprocessSharePreviews(updated, effective);
    return {
      share: updated,
      changedPhotoCount: photos.length,
      overlaySettings: clientOverlayPayload(effective),
      overlayAsset: null,
    };
  }

  return {
    assignToShare: (token, payload = {}) => runShareOverlayJob(token, () => assignToShareNow(token, payload)),
    clearFromShare: (token) => runShareOverlayJob(token, () => clearFromShareNow(token)),
    clientOverlayPayload,
    effectiveForShare,
  };
}

module.exports = {
  clientOverlayPayload,
  createGalleryOverlayService,
};
