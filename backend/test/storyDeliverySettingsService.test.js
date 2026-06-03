const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createStoryDeliverySettingsService,
  normalizeStoryDeliverySettings,
} = require('../src/services/storyDeliverySettingsService');

test('story delivery settings normalize the new-gallery default', () => {
  assert.deepEqual(normalizeStoryDeliverySettings({ defaultEnabled: true }), { defaultEnabled: true });
  assert.deepEqual(normalizeStoryDeliverySettings({ defaultEnabled: 'true' }), { defaultEnabled: false });
});

test('story delivery readiness accepts enabled galleries without overlay setup', async () => {
  const service = createStoryDeliverySettingsService({
    repos: {
      getSettings: async () => ({}),
      upsertSettings: async () => ({}),
    },
  });

  assert.equal(await service.assertReady({ enabled: true }), true);
});

test('story delivery readiness accepts active overlays without requiring a story profile', async () => {
  const service = createStoryDeliverySettingsService({
    repos: {
      getSettings: async () => ({}),
      upsertSettings: async () => ({}),
    },
  });

  assert.equal(await service.assertReady({ enabled: true, overlayAssetId: 'overlay_1' }), true);
});

test('story delivery readiness accepts disabled gallery overlays', async () => {
  const service = createStoryDeliverySettingsService({
    repos: {
      getSettings: async () => ({}),
      upsertSettings: async () => ({}),
    },
  });

  assert.equal(await service.assertReady({
    enabled: true,
    overlayAssetId: 'overlay_1',
    share: { overlayAssetId: 'overlay_1', overlayEnabled: false },
  }), true);
});
