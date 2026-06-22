const DELIVERY_MODES = Object.freeze({
  WHATSAPP: 'whatsapp',
  DOWNLOAD: 'download',
  BOTH: 'both',
});

const DEFAULT_DELIVERY_MODE = DELIVERY_MODES.BOTH;
const LEGACY_DELIVERY_MODE = DELIVERY_MODES.WHATSAPP;

function normalizeDeliveryMode(value, fallback = DEFAULT_DELIVERY_MODE) {
  const mode = String(value || '').trim().toLowerCase();
  return Object.values(DELIVERY_MODES).includes(mode) ? mode : fallback;
}

function allowsGalleryDownload(mode) {
  return [DELIVERY_MODES.DOWNLOAD, DELIVERY_MODES.BOTH].includes(normalizeDeliveryMode(mode, LEGACY_DELIVERY_MODE));
}

function allowsWhatsappDelivery(mode) {
  return [DELIVERY_MODES.WHATSAPP, DELIVERY_MODES.BOTH].includes(normalizeDeliveryMode(mode, LEGACY_DELIVERY_MODE));
}

function createDeliveryModeSettingsService({ repos }) {
  async function getSettings() {
    if (typeof repos.getSettings !== 'function') {
      return { defaultDeliveryMode: DEFAULT_DELIVERY_MODE };
    }
    const raw = await repos.getSettings();
    return {
      defaultDeliveryMode: normalizeDeliveryMode(raw.defaultDeliveryMode, DEFAULT_DELIVERY_MODE),
    };
  }

  async function updateSettings(settings = {}) {
    const normalized = normalizeDeliveryMode(settings.defaultDeliveryMode, DEFAULT_DELIVERY_MODE);
    if (typeof repos.upsertSettings !== 'function') {
      return { defaultDeliveryMode: normalized };
    }
    await repos.upsertSettings({ defaultDeliveryMode: normalized });
    return getSettings();
  }

  return { getSettings, updateSettings };
}

module.exports = {
  DEFAULT_DELIVERY_MODE,
  DELIVERY_MODES,
  LEGACY_DELIVERY_MODE,
  allowsGalleryDownload,
  allowsWhatsappDelivery,
  createDeliveryModeSettingsService,
  normalizeDeliveryMode,
};
