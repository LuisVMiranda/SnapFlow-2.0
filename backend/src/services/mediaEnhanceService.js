const sharp = require('sharp');

const AUTO_ENHANCE_PRESETS = {
  soft: {
    brightness: 1.03,
    saturation: 1.04,
    contrast: 1.04,
    intercept: -4,
    sharpenSigma: 1.1,
    jpegQuality: 92,
  },
  balanced: {
    brightness: 1.06,
    saturation: 1.08,
    contrast: 1.08,
    intercept: -6,
    sharpenSigma: 1.15,
    jpegQuality: 92,
  },
  cinematic: {
    brightness: 1.07,
    saturation: 1.1,
    contrast: 1.12,
    intercept: -8,
    sharpenSigma: 1.2,
    jpegQuality: 92,
  },
};

const LOW_LIGHT_PRESET = {
  brightness: 1.14,
  saturation: 1.06,
  contrast: 1.02,
  intercept: 10,
  sharpenSigma: 1.05,
  jpegQuality: 92,
  mode: 'low_light',
};

const DIM_LIGHT_PRESET = {
  brightness: 1.1,
  saturation: 1.07,
  contrast: 1.04,
  intercept: 6,
  sharpenSigma: 1.08,
  jpegQuality: 92,
  mode: 'dim_light',
};

function autoEnhancePreset(level = 'balanced') {
  return AUTO_ENHANCE_PRESETS[level] || AUTO_ENHANCE_PRESETS.balanced;
}

function luminanceFromStats(stats) {
  const channels = stats?.channels || [];
  if (channels.length < 3) return null;
  const values = channels.slice(0, 3).map((channel) => Number(channel.mean));
  if (!values.every(Number.isFinite)) return null;
  return (values[0] * 0.2126) + (values[1] * 0.7152) + (values[2] * 0.0722);
}

function adaptiveAutoEnhancePreset(level = 'balanced', stats = null) {
  const base = autoEnhancePreset(level);
  const luminance = luminanceFromStats(stats);
  if (!Number.isFinite(luminance)) return { ...base, mode: level };
  if (luminance < 82) return { ...LOW_LIGHT_PRESET, luminance };
  if (luminance < 112) return { ...DIM_LIGHT_PRESET, luminance };
  return { ...base, mode: level, luminance };
}

async function imageToneStats(filePath) {
  return sharp(filePath, { sequentialRead: true })
    .rotate()
    .resize({ width: 96, height: 96, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .stats();
}

function applyAutoEnhance(image, levelOrPreset = 'balanced') {
  const preset = typeof levelOrPreset === 'object' ? levelOrPreset : autoEnhancePreset(levelOrPreset);
  return image
    .modulate({
      brightness: preset.brightness,
      saturation: preset.saturation,
    })
    .linear(preset.contrast, preset.intercept)
    .sharpen({
      sigma: preset.sharpenSigma,
    });
}

module.exports = {
  AUTO_ENHANCE_PRESETS,
  adaptiveAutoEnhancePreset,
  applyAutoEnhance,
  autoEnhancePreset,
  imageToneStats,
};
