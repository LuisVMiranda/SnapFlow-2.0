const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_PHOTO_PRESET_SETTINGS,
  MAX_PRESETS_PER_GALLERY,
  createPhotoEditingPresetService,
  jpegQualityForPresetStack,
  normalizePhotoPreset,
  normalizePhotoPresetIds,
  normalizePhotoPresetSettings,
  presetToSharpAdjustments,
  resolvePhotoPresetStack,
} = require('../src/services/photoEditingPresetService');

function createMemoryRepos(initialPresets = []) {
  let settings = { photoEditingPresets: initialPresets };
  return {
    async getSettings() {
      return settings;
    },
    async upsertSettings(nextSettings) {
      settings = { ...settings, ...nextSettings };
      return settings;
    },
  };
}

test('photo preset settings normalize to safe image-processing ranges', () => {
  const normalized = normalizePhotoPresetSettings({
    exposure: 99,
    brightness: -10,
    contrast: '1.23456',
    saturation: 9,
    shadows: 999,
    blacks: -999,
    whites: 999,
    hue: -999,
    gamma: 0.2,
    temperature: 999,
    tint: -999,
    sharpen: 9,
    jpegQuality: 10,
  });

  assert.equal(normalized.exposure, 2);
  assert.equal(normalized.brightness, 0.5);
  assert.equal(normalized.contrast, 1.235);
  assert.equal(normalized.saturation, 2);
  assert.equal(normalized.shadows, 100);
  assert.equal(normalized.blacks, -100);
  assert.equal(normalized.whites, 100);
  assert.equal(normalized.hue, -180);
  assert.equal(normalized.gamma, 1);
  assert.equal(normalized.temperature, 100);
  assert.equal(normalized.tint, -100);
  assert.equal(normalized.sharpen, 3);
  assert.equal(normalized.jpegQuality, 60);
});

test('photo presets require a useful name and stable id', () => {
  const preset = normalizePhotoPreset({
    name: '  Noite   Baixa Luz  ',
    settings: { brightness: 1.2 },
  });

  assert.equal(preset.id, 'noite-baixa-luz');
  assert.equal(preset.name, 'Noite Baixa Luz');
  assert.equal(preset.settings.brightness, 1.2);
  assert.equal(preset.settings.contrast, DEFAULT_PHOTO_PRESET_SETTINGS.contrast);
});

test('photo preset stack is limited to three presets per gallery', () => {
  assert.deepEqual(normalizePhotoPresetIds(['a', 'a', 'b', 'c']), ['a', 'b', 'c']);
  assert.throws(
    () => normalizePhotoPresetIds(['a', 'b', 'c', 'd']),
    /máximo 3 presets/
  );
  assert.equal(MAX_PRESETS_PER_GALLERY, 3);
});

test('photo preset stack resolves saved presets in selected order', () => {
  const presets = [
    normalizePhotoPreset({ id: 'soft', name: 'Soft' }),
    normalizePhotoPreset({ id: 'night', name: 'Night' }),
  ];

  const stack = resolvePhotoPresetStack(presets, ['night', 'soft']);

  assert.deepEqual(stack.map((preset) => preset.id), ['night', 'soft']);
});

test('photo preset adjustments are valid sharp parameters', () => {
  const adjustments = presetToSharpAdjustments({
    exposure: 1,
    brightness: 1.1,
    contrast: 1.2,
    saturation: 1.1,
    shadows: 25,
    blacks: -15,
    whites: 20,
    hue: 20,
    gamma: 1.4,
    sharpen: 2,
    jpegQuality: 88,
  });

  assert.ok(adjustments.brightness > 0);
  assert.ok(adjustments.saturation >= 0);
  assert.ok(adjustments.gamma >= 1 && adjustments.gamma <= 3);
  assert.ok(Number.isFinite(adjustments.intercept));
  assert.notEqual(adjustments.intercept, 0);
  assert.ok(adjustments.sharpenSigma > 0);
  assert.equal(jpegQualityForPresetStack([{ settings: { jpegQuality: 88 } }]), 88);
});

test('photo editing preset service creates, updates and deletes presets', async () => {
  const service = createPhotoEditingPresetService({ repos: createMemoryRepos() });

  let presets = await service.createPreset({ name: 'Evento interno', settings: { contrast: 1.1 } });
  assert.equal(presets.length, 1);
  assert.equal(presets[0].id, 'evento-interno');

  presets = await service.updatePreset('evento-interno', { name: 'Evento interno leve', settings: { saturation: 1.2 } });
  assert.equal(presets[0].name, 'Evento interno leve');
  assert.equal(presets[0].settings.saturation, 1.2);

  presets = await service.deletePreset('evento-interno');
  assert.equal(presets.length, 0);
});
