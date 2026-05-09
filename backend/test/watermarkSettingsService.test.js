const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const {
  DEFAULT_WATERMARK_SETTINGS,
  createWatermarkSettingsService,
  normalizeWatermarkSettings,
} = require('../src/services/watermarkSettingsService');

function createMemoryRepos(initialSettings = {}) {
  let settings = { ...initialSettings };
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

test('watermark settings fall back to safe defaults', async () => {
  const service = createWatermarkSettingsService({
    repos: createMemoryRepos(),
  });

  assert.deepEqual(await service.getSettings(), DEFAULT_WATERMARK_SETTINGS);
});

test('watermark settings normalize admin input before saving', async () => {
  const service = createWatermarkSettingsService({
    repos: createMemoryRepos(),
  });

  const saved = await service.updateSettings({
    width: '9999',
    height: '10',
    opacity: '0.333',
    instances: '7.7',
  });

  assert.deepEqual(saved, {
    width: 900,
    height: 40,
    opacity: 0.33,
    instances: 8,
  });
});

test('watermark normalization is always within supported limits', () => {
  fc.assert(
    fc.property(
      fc.record({
        width: fc.oneof(fc.integer(), fc.double({ noNaN: true }), fc.string(), fc.constant(null)),
        height: fc.oneof(fc.integer(), fc.double({ noNaN: true }), fc.string(), fc.constant(null)),
        opacity: fc.oneof(fc.double({ noNaN: true }), fc.string(), fc.constant(null)),
        instances: fc.oneof(fc.integer(), fc.double({ noNaN: true }), fc.string(), fc.constant(null)),
      }),
      (value) => {
        const normalized = normalizeWatermarkSettings(value);
        assert.equal(Number.isInteger(normalized.width), true);
        assert.equal(normalized.width >= 120 && normalized.width <= 900, true);
        assert.equal(Number.isInteger(normalized.height), true);
        assert.equal(normalized.height >= 40 && normalized.height <= 360, true);
        assert.equal(normalized.opacity >= 0.05 && normalized.opacity <= 0.95, true);
        assert.equal(Number.isInteger(normalized.instances), true);
        assert.equal(normalized.instances >= 1 && normalized.instances <= 24, true);
      }
    )
  );
});
