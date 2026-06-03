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

  async function assertReady({ enabled } = {}) {
    if (!enabled) return true;
    return true;
  }

  return { assertReady, getSettings, updateSettings };
}

module.exports = {
  DEFAULT_STORY_DELIVERY_SETTINGS,
  createStoryDeliverySettingsService,
  normalizeStoryDeliverySettings,
};
