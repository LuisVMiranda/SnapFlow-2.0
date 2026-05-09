const { HttpError } = require('../errors');

const DEFAULT_WATERMARK_SETTINGS = Object.freeze({
  width: 420,
  height: 140,
  opacity: 0.55,
  instances: 1,
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

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampInteger(value, fallback, min, max) {
  return Math.round(clampNumber(value, fallback, min, max));
}

function normalizeWatermarkSettings(value = {}) {
  const source = parseSetting(value);
  return {
    width: clampInteger(source.width, DEFAULT_WATERMARK_SETTINGS.width, 120, 900),
    height: clampInteger(source.height, DEFAULT_WATERMARK_SETTINGS.height, 40, 360),
    opacity: Number(clampNumber(source.opacity, DEFAULT_WATERMARK_SETTINGS.opacity, 0.05, 0.95).toFixed(2)),
    instances: clampInteger(source.instances, DEFAULT_WATERMARK_SETTINGS.instances, 1, 24),
  };
}

function createWatermarkSettingsService({ repos }) {
  async function getSettings() {
    const raw = await repos.getSettings();
    return normalizeWatermarkSettings(raw.watermarkSettings);
  }

  async function updateSettings(settings) {
    const normalized = normalizeWatermarkSettings(settings);
    if (!normalized.width || !normalized.height) {
      throw new HttpError(400, "Informe dimensões válidas para a marca d'água.", 'watermark_dimensions_invalid');
    }
    await repos.upsertSettings({ watermarkSettings: normalized });
    return getSettings();
  }

  return { getSettings, updateSettings };
}

module.exports = {
  DEFAULT_WATERMARK_SETTINGS,
  createWatermarkSettingsService,
  normalizeWatermarkSettings,
};
