const { HttpError } = require('../errors');
const { normalizeWatermarkSettings } = require('./watermarkSettingsService');
const { watermarkAssetPayload } = require('./watermarkAssetService');
const { normalizeOverlaySettings } = require('./overlaySettingsService');

function hasExplicitWatermarkSettings(value = {}) {
  return ['width', 'height', 'opacity', 'instances'].some((field) => value[field] !== undefined && value[field] !== null);
}

function clientWatermarkPayload(effective, accessToken = '') {
  if (!effective || effective.kind !== 'image') return effective?.settings || {};
  const params = new URLSearchParams();
  if (accessToken) params.set('access_token', accessToken);
  const query = params.toString();
  return {
    ...effective.settings,
    kind: 'image',
    assetId: effective.asset.id,
    name: effective.asset.name,
    assetUrl: `/api/share-session/${effective.share.token}/watermark/${effective.asset.id}${query ? `?${query}` : ''}`,
  };
}

function adminWatermarkAssetPayload(asset) {
  return watermarkAssetPayload(asset);
}

function createKeyedAsyncQueue() {
  const pendingByKey = new Map();
  return function runQueued(key, task) {
    const previous = pendingByKey.get(key) || Promise.resolve();
    const run = previous.catch(() => {}).then(task);
    const cleanup = run.finally(() => {
      if (pendingByKey.get(key) === cleanup) pendingByKey.delete(key);
    }).catch(() => {});
    pendingByKey.set(key, cleanup);
    return run;
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

function createGalleryWatermarkService({ media, repos, watermarkSettings }) {
  const runShareWatermarkJob = createKeyedAsyncQueue();

  async function defaultSettings() {
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

  async function settingsForShare(share, fallback = null) {
    if (hasExplicitWatermarkSettings(share.watermarkSettings || {})) {
      return normalizeWatermarkSettings(share.watermarkSettings);
    }
    return normalizeWatermarkSettings(fallback || await defaultSettings());
  }

  async function effectiveForShare(shareOrToken) {
    const share = typeof shareOrToken === 'string' ? await getShareOrFail(shareOrToken) : shareOrToken;
    const settings = await settingsForShare(share);
    if (!share?.watermarkAssetId || typeof repos.getWatermarkAsset !== 'function') {
      return { kind: 'default', settings, share };
    }
    const asset = await repos.getWatermarkAsset(share.watermarkAssetId);
    if (!asset) return { kind: 'default', settings, share };
    return {
      kind: 'image',
      asset,
      assetPath: asset.storagePath,
      settings,
      share,
    };
  }

  async function reprocessSharePreviews(share, watermark) {
    if (!media || typeof media.reprocessPhotoWatermark !== 'function' || typeof repos.listPhotosForShare !== 'function') {
      return [];
    }
    const overlay = await overlayForShare(share);
    const photos = await repos.listPhotosForShare(share.token);
    return mapWithSmallConcurrency(photos, 2, async (photo) => {
      const processed = await media.reprocessPhotoWatermark(photo, watermark, { overlay });
      return repos.updatePhotoWatermarkState(photo.id, processed);
    });
  }

  async function overlayForShare(share) {
    if (!share?.overlayEnabled || !share.overlayAssetId || typeof repos.getOverlayAsset !== 'function') return null;
    const asset = await repos.getOverlayAsset(share.overlayAssetId);
    if (!asset) return null;
    return {
      enabled: true,
      kind: 'image',
      asset,
      assetPath: asset.storagePath,
      settings: normalizeOverlaySettings(share.overlaySettings || {}),
      share,
    };
  }

  async function assignToShareNow(token, payload = {}) {
    const share = await getShareOrFail(token);
    const assetId = String(payload.assetId || '').trim();
    if (!assetId) {
      throw new HttpError(400, "Selecione uma marca d'água para aplicar nesta galeria.", 'watermark_asset_required');
    }
    const asset = await repos.getWatermarkAsset(assetId);
    if (!asset) throw new HttpError(404, "Marca d'água não encontrada.", 'watermark_asset_not_found');
    const fallbackSettings = await defaultSettings();
    const settings = normalizeWatermarkSettings(hasExplicitWatermarkSettings(payload.settings || {}) ? payload.settings : fallbackSettings);
    const updated = await repos.updateShareWatermarkState(share.token, {
      watermarkAssetId: asset.id,
      watermarkSettings: settings,
      watermarkUpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new HttpError(
        409,
        "Esta marca d'água não está mais disponível. Atualize a biblioteca e tente novamente.",
        'watermark_asset_conflict'
      );
    }
    const effective = await effectiveForShare(updated);
    const photos = await reprocessSharePreviews(updated, effective);
    return {
      share: updated,
      changedPhotoCount: photos.length,
      watermarkSettings: clientWatermarkPayload(effective),
      watermarkAsset: adminWatermarkAssetPayload(asset),
    };
  }

  async function clearFromShareNow(token) {
    const share = await getShareOrFail(token);
    const updated = await repos.updateShareWatermarkState(share.token, {
      watermarkAssetId: null,
      watermarkSettings: {},
      watermarkUpdatedAt: new Date().toISOString(),
    });
    if (!updated) throw new HttpError(404, 'Galeria não encontrada. Atualize Galerias e confirme se o link ainda existe.', 'share_not_found');
    const effective = await effectiveForShare(updated);
    const photos = await reprocessSharePreviews(updated, effective);
    return {
      share: updated,
      changedPhotoCount: photos.length,
      watermarkSettings: clientWatermarkPayload(effective),
      watermarkAsset: null,
    };
  }

  return {
    assignToShare: (token, payload = {}) => runShareWatermarkJob(token, () => assignToShareNow(token, payload)),
    clearFromShare: (token) => runShareWatermarkJob(token, () => clearFromShareNow(token)),
    clientWatermarkPayload,
    effectiveForShare,
  };
}

module.exports = {
  clientWatermarkPayload,
  createKeyedAsyncQueue,
  createGalleryWatermarkService,
  hasExplicitWatermarkSettings,
};
