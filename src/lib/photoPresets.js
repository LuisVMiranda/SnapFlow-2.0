export const MAX_PRESETS_PER_GALLERY = 3;

export const PHOTO_PRESET_BOUNDS = {
  exposure: { min: -2, max: 2, fallback: 0, step: 0.1, label: 'Exposição' },
  brightness: { min: 0.5, max: 1.8, fallback: 1, step: 0.01, label: 'Brilho' },
  contrast: { min: 0.5, max: 1.8, fallback: 1, step: 0.01, label: 'Contraste' },
  saturation: { min: 0, max: 2, fallback: 1, step: 0.01, label: 'Saturação' },
  shadows: { min: -100, max: 100, fallback: 0, step: 1, label: 'Sombras' },
  blacks: { min: -100, max: 100, fallback: 0, step: 1, label: 'Pretos' },
  whites: { min: -100, max: 100, fallback: 0, step: 1, label: 'Brancos' },
  hue: { min: -180, max: 180, fallback: 0, step: 1, label: 'Matiz' },
  gamma: { min: 1, max: 3, fallback: 1, step: 0.01, label: 'Gama' },
  temperature: { min: -100, max: 100, fallback: 0, step: 1, label: 'Temperatura' },
  tint: { min: -100, max: 100, fallback: 0, step: 1, label: 'Tinta' },
  sharpen: { min: 0, max: 3, fallback: 0, step: 0.1, label: 'Nitidez' },
  jpegQuality: { min: 60, max: 98, fallback: 92, step: 1, label: 'Qualidade JPG' },
};

export const DEFAULT_PHOTO_PRESET_SETTINGS = Object.fromEntries(
  Object.entries(PHOTO_PRESET_BOUNDS).map(([key, bounds]) => [key, bounds.fallback])
);

export function clampPhotoPresetValue(key, value) {
  const bounds = PHOTO_PRESET_BOUNDS[key];
  if (!bounds) return value;
  let parsed;
  try {
    parsed = Number(value);
  } catch {
    parsed = Number.NaN;
  }
  const safeValue = Number.isFinite(parsed) ? parsed : bounds.fallback;
  return Number(Math.min(bounds.max, Math.max(bounds.min, safeValue)).toFixed(3));
}

export function normalizePhotoPresetSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    Object.keys(PHOTO_PRESET_BOUNDS).map((key) => [key, clampPhotoPresetValue(key, source[key])])
  );
}

export function normalizePhotoPresetIds(value = []) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((id) => String(id || '').trim().toLowerCase())
    .filter(Boolean))]
    .slice(0, MAX_PRESETS_PER_GALLERY);
}

export function mergePresetIds(ids, nextId) {
  const normalized = normalizePhotoPresetIds(ids);
  if (normalized.includes(nextId)) return normalized.filter((id) => id !== nextId);
  if (normalized.length >= MAX_PRESETS_PER_GALLERY) return normalized;
  return [...normalized, nextId];
}

export function resolvePresetStack(presets = [], ids = []) {
  const byId = new Map(presets.map((preset) => [preset.id, preset]));
  return normalizePhotoPresetIds(ids).map((id) => byId.get(id)).filter(Boolean);
}

export function buildPresetFilter(presetStack = []) {
  const combined = presetStack.reduce((acc, preset) => {
    const settings = normalizePhotoPresetSettings(preset.settings || preset);
    const exposureBoost = 2 ** settings.exposure;
    const tonalBrightness = 1 + settings.shadows * 0.001 + settings.blacks * 0.0004 + settings.whites * 0.0015;
    const tonalContrast = 1 - settings.shadows * 0.0008 - settings.blacks * 0.001 + settings.whites * 0.001;
    return {
      brightness: acc.brightness * settings.brightness * exposureBoost * tonalBrightness,
      contrast: acc.contrast * settings.contrast * tonalContrast,
      saturation: acc.saturation * settings.saturation,
      hue: acc.hue + settings.hue + settings.temperature * 0.08 + settings.tint * 0.04,
    };
  }, { brightness: 1, contrast: 1, saturation: 1, hue: 0 });

  return [
    `brightness(${Math.max(0.2, Math.min(3, combined.brightness)).toFixed(3)})`,
    `contrast(${Math.max(0.2, Math.min(3, combined.contrast)).toFixed(3)})`,
    `saturate(${Math.max(0, Math.min(3, combined.saturation)).toFixed(3)})`,
    `hue-rotate(${Math.max(-360, Math.min(360, combined.hue)).toFixed(1)}deg)`,
  ].join(' ');
}
