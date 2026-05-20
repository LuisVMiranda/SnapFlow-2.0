const { HttpError } = require('../errors');

const MAX_PRESETS_PER_GALLERY = 3;

const PHOTO_PRESET_BOUNDS = {
  exposure: { min: -2, max: 2, fallback: 0 },
  brightness: { min: 0.5, max: 1.8, fallback: 1 },
  contrast: { min: 0.5, max: 1.8, fallback: 1 },
  saturation: { min: 0, max: 2, fallback: 1 },
  shadows: { min: -100, max: 100, fallback: 0 },
  blacks: { min: -100, max: 100, fallback: 0 },
  whites: { min: -100, max: 100, fallback: 0 },
  hue: { min: -180, max: 180, fallback: 0 },
  gamma: { min: 1, max: 3, fallback: 1 },
  temperature: { min: -100, max: 100, fallback: 0 },
  tint: { min: -100, max: 100, fallback: 0 },
  sharpen: { min: 0, max: 3, fallback: 0 },
  jpegQuality: { min: 60, max: 98, fallback: 92 },
};

const DEFAULT_PHOTO_PRESET_SETTINGS = Object.fromEntries(
  Object.entries(PHOTO_PRESET_BOUNDS).map(([key, bounds]) => [key, bounds.fallback])
);

function clamp(value, bounds) {
  let parsed;
  try {
    parsed = Number(value);
  } catch {
    parsed = Number.NaN;
  }
  const safeValue = Number.isFinite(parsed) ? parsed : bounds.fallback;
  const clamped = Math.min(bounds.max, Math.max(bounds.min, safeValue));
  return Number(clamped.toFixed(3));
}

function normalizePhotoPresetSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    Object.entries(PHOTO_PRESET_BOUNDS).map(([key, bounds]) => [key, clamp(source[key], bounds)])
  );
}

function normalizePresetId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function normalizePhotoPreset(value = {}) {
  const name = String(value.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name) {
    throw new HttpError(400, 'Informe um nome para o preset de edição. Exemplo: "Evento interno" ou "Noite baixa luz".', 'photo_preset_name_required');
  }
  const normalizedId = normalizePresetId(value.id || name);
  if (!normalizedId) {
    throw new HttpError(400, 'Informe um identificador válido para o preset. Use letras, números, hífen ou sublinhado.', 'photo_preset_id_invalid');
  }
  return {
    id: normalizedId,
    name,
    description: String(value.description || '').replace(/\s+/g, ' ').trim().slice(0, 240),
    enabled: value.enabled !== false,
    settings: normalizePhotoPresetSettings(value.settings),
    createdAt: value.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizePhotoPresetCollection(value = []) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const presets = [];
  for (const preset of source) {
    const normalized = normalizePhotoPreset(preset);
    if (seen.has(normalized.id)) {
      throw new HttpError(400, `Já existe um preset com o identificador "${normalized.id}". Renomeie um deles e tente novamente.`, 'photo_preset_duplicate');
    }
    seen.add(normalized.id);
    presets.push(normalized);
  }
  return presets;
}

function normalizePhotoPresetIds(value = []) {
  const ids = [...new Set((Array.isArray(value) ? value : []).map(normalizePresetId).filter(Boolean))];
  if (ids.length > MAX_PRESETS_PER_GALLERY) {
    throw new HttpError(400, 'Escolha no máximo 3 presets por galeria. Remova um ajuste antes de adicionar outro.', 'photo_preset_limit_exceeded');
  }
  return ids;
}

function resolvePhotoPresetStack(presets = [], presetIds = []) {
  const ids = normalizePhotoPresetIds(presetIds);
  const byId = new Map(presets.map((preset) => [preset.id, preset]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new HttpError(404, `Preset não encontrado: ${missing.join(', ')}. Atualize Configurações e tente novamente.`, 'photo_preset_not_found');
  }
  return ids.map((id) => byId.get(id)).filter((preset) => preset.enabled !== false);
}

function presetToSharpAdjustments(settings = DEFAULT_PHOTO_PRESET_SETTINGS) {
  const normalized = normalizePhotoPresetSettings(settings);
  const exposureBoost = 2 ** normalized.exposure;
  const tonalBrightness = 1 + normalized.shadows * 0.001 + normalized.blacks * 0.0004 + normalized.whites * 0.0015;
  const brightness = Number((normalized.brightness * exposureBoost * tonalBrightness).toFixed(3));
  const contrast = Number((normalized.contrast * (1 - normalized.shadows * 0.0008 - normalized.blacks * 0.001 + normalized.whites * 0.001)).toFixed(3));
  const tonalIntercept = normalized.shadows * 0.35 + normalized.blacks * 0.5 + normalized.whites * 0.12;
  const intercept = Number((((1 - contrast) * 128) + normalized.temperature * 0.12 + normalized.tint * 0.06 + tonalIntercept).toFixed(3));
  return {
    brightness,
    saturation: normalized.saturation,
    hue: normalized.hue,
    gamma: normalized.gamma,
    contrast,
    intercept,
    sharpenSigma: normalized.sharpen > 0 ? Number((0.3 + normalized.sharpen * 0.45).toFixed(3)) : 0,
    jpegQuality: Math.round(normalized.jpegQuality),
  };
}

function applyPhotoEditingPreset(image, settings = DEFAULT_PHOTO_PRESET_SETTINGS) {
  const adjustments = presetToSharpAdjustments(settings);
  let pipeline = image
    .modulate({
      brightness: adjustments.brightness,
      saturation: adjustments.saturation,
      hue: adjustments.hue,
    })
    .gamma(adjustments.gamma)
    .linear(adjustments.contrast, adjustments.intercept);
  if (adjustments.sharpenSigma > 0) {
    pipeline = pipeline.sharpen({ sigma: adjustments.sharpenSigma });
  }
  return pipeline;
}

function applyPhotoEditingStack(image, presets = []) {
  return presets.reduce((pipeline, preset) => applyPhotoEditingPreset(pipeline, preset.settings || preset), image);
}

function jpegQualityForPresetStack(presets = [], fallback = 92) {
  const qualities = presets
    .map((preset) => normalizePhotoPresetSettings(preset.settings || preset).jpegQuality)
    .filter(Number.isFinite);
  if (!qualities.length) return fallback;
  return Math.round(Math.min(...qualities));
}

function createPhotoEditingPresetService({ repos }) {
  async function getPresets() {
    const raw = await repos.getSettings();
    return normalizePhotoPresetCollection(raw.photoEditingPresets || []);
  }

  async function savePresets(presets) {
    const normalized = normalizePhotoPresetCollection(presets);
    await repos.upsertSettings({ photoEditingPresets: normalized });
    return getPresets();
  }

  async function createPreset(preset) {
    const presets = await getPresets();
    const normalized = normalizePhotoPreset(preset);
    if (presets.some((existing) => existing.id === normalized.id)) {
      throw new HttpError(400, `Já existe um preset chamado "${normalized.name}". Use outro nome ou edite o preset existente.`, 'photo_preset_duplicate');
    }
    return savePresets([...presets, normalized]);
  }

  async function updatePreset(presetId, preset) {
    const id = normalizePresetId(presetId);
    const presets = await getPresets();
    const index = presets.findIndex((existing) => existing.id === id);
    if (index < 0) {
      throw new HttpError(404, 'Preset não encontrado. Atualize Configurações e tente novamente.', 'photo_preset_not_found');
    }
    const normalized = normalizePhotoPreset({ ...presets[index], ...preset, id });
    presets[index] = {
      ...normalized,
      createdAt: presets[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    return savePresets(presets);
  }

  async function deletePreset(presetId) {
    const id = normalizePresetId(presetId);
    const presets = await getPresets();
    if (!presets.some((existing) => existing.id === id)) {
      throw new HttpError(404, 'Preset não encontrado. Atualize Configurações e tente novamente.', 'photo_preset_not_found');
    }
    return savePresets(presets.filter((preset) => preset.id !== id));
  }

  return {
    createPreset,
    deletePreset,
    getPresets,
    savePresets,
    updatePreset,
  };
}

module.exports = {
  DEFAULT_PHOTO_PRESET_SETTINGS,
  MAX_PRESETS_PER_GALLERY,
  PHOTO_PRESET_BOUNDS,
  applyPhotoEditingPreset,
  applyPhotoEditingStack,
  createPhotoEditingPresetService,
  jpegQualityForPresetStack,
  normalizePhotoPreset,
  normalizePhotoPresetCollection,
  normalizePhotoPresetIds,
  normalizePhotoPresetSettings,
  presetToSharpAdjustments,
  resolvePhotoPresetStack,
};
