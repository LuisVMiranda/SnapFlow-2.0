const { HttpError } = require('../errors');
const { hasExplicitOverlayPlacement } = require('./overlaySettingsService');

const STORY_DELIVERY_SETUP_MESSAGE = 'Configure primeiro o overlay para Stories. Vá em Configurações > Overlays de galeria, abra o overlay usado nesta galeria e ajuste a prévia 9:16 de Stories. Depois volte para esta galeria e ative a entrega em formato Stories.';

const DEFAULT_STORY_DELIVERY_SETTINGS = Object.freeze({
  defaultEnabled: false,
});

function parseSetting(value) {
  if (value === undefined || value === null) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeStoryDeliverySettings(value = {}) {
  const source = parseSetting(value);
  return {
    defaultEnabled: source.defaultEnabled === true,
  };
}

function storyOverlayReady(asset) {
  return Boolean(asset && hasExplicitOverlayPlacement(asset.storySettings));
}

function storyDeliveryError() {
  return new HttpError(400, STORY_DELIVERY_SETUP_MESSAGE, 'story_overlay_profile_required');
}

function resolveOverlayEnabled({ overlayAssetId = '', overlayEnabled, share = null } = {}) {
  if (overlayEnabled !== undefined) return overlayEnabled === true;
  if (!share) return Boolean(String(overlayAssetId || '').trim());
  return share.overlayEnabled === true;
}

function createStoryDeliverySettingsService({ repos }) {
  async function getSettings() {
    const raw = await repos.getSettings();
    return normalizeStoryDeliverySettings(raw.storyDeliverySettings || DEFAULT_STORY_DELIVERY_SETTINGS);
  }

  async function updateSettings(settings = {}) {
    const normalized = normalizeStoryDeliverySettings(settings);
    await repos.upsertSettings({ storyDeliverySettings: normalized });
    return getSettings();
  }

  async function assertReady({ enabled, overlayAssetId = '', overlayEnabled, share = null } = {}) {
    if (!enabled) return true;
    const assetId = String(overlayAssetId || share?.overlayAssetId || '').trim();
    if (!assetId || !resolveOverlayEnabled({ overlayAssetId, overlayEnabled, share })) {
      throw storyDeliveryError();
    }
    const asset = typeof repos.getOverlayAsset === 'function' ? await repos.getOverlayAsset(assetId) : null;
    if (!storyOverlayReady(asset)) throw storyDeliveryError();
    return true;
  }

  return { assertReady, getSettings, updateSettings };
}

module.exports = {
  DEFAULT_STORY_DELIVERY_SETTINGS,
  STORY_DELIVERY_SETUP_MESSAGE,
  createStoryDeliverySettingsService,
  normalizeStoryDeliverySettings,
  storyOverlayReady,
};
