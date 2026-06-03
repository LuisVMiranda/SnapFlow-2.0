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

test('story delivery readiness requires an active overlay asset story profile', async () => {
  const service = createStoryDeliverySettingsService({
    repos: {
      getSettings: async () => ({}),
      upsertSettings: async () => ({}),
      getOverlayAsset: async () => ({ id: 'overlay_1', storySettings: {} }),
    },
  });

  await assert.rejects(
    () => service.assertReady({ enabled: true, overlayAssetId: 'overlay_1' }),
    (error) => error.status === 400 && error.code === 'story_overlay_profile_required'
  );
});

test('story delivery readiness accepts a configured story profile', async () => {
  const service = createStoryDeliverySettingsService({
    repos: {
      getSettings: async () => ({}),
      upsertSettings: async () => ({}),
      getOverlayAsset: async () => ({
        id: 'overlay_1',
        storySettings: { x: 0.5, y: 0.9, widthRatio: 0.2, opacity: 1 },
      }),
    },
  });

  assert.equal(await service.assertReady({ enabled: true, overlayAssetId: 'overlay_1' }), true);
});

test('story delivery readiness rejects disabled gallery overlays', async () => {
  const service = createStoryDeliverySettingsService({
    repos: {
      getSettings: async () => ({}),
      upsertSettings: async () => ({}),
      getOverlayAsset: async () => ({
        id: 'overlay_1',
        storySettings: { x: 0.5, y: 0.9, widthRatio: 0.2, opacity: 1 },
      }),
    },
  });

  await assert.rejects(
    () => service.assertReady({
      enabled: true,
      overlayAssetId: 'overlay_1',
      share: { overlayAssetId: 'overlay_1', overlayEnabled: false },
    }),
    (error) => error.status === 400 && error.code === 'story_overlay_profile_required'
  );
});
