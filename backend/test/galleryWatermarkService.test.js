const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const {
  clientWatermarkPayload,
  createGalleryWatermarkService,
} = require('../src/services/galleryWatermarkService');

function createMemoryService() {
  const shares = new Map([
    ['share_a', { token: 'share_a', watermarkAssetId: '', watermarkSettings: {} }],
    ['share_b', { token: 'share_b', watermarkAssetId: '', watermarkSettings: {} }],
  ]);
  const assets = new Map([
    ['asset_a', { id: 'asset_a', name: 'Brand A', storagePath: 'watermark-assets/a.png' }],
    ['asset_b', { id: 'asset_b', name: 'Brand B', storagePath: 'watermark-assets/b.png' }],
  ]);
  const repos = {
    async getShareSession(token) {
      return shares.get(token) || null;
    },
    async getWatermarkAsset(id) {
      return assets.get(id) || null;
    },
    async updateShareWatermarkState(token, updates) {
      const next = {
        ...shares.get(token),
        watermarkAssetId: updates.watermarkAssetId || '',
        watermarkSettings: updates.watermarkSettings || {},
        watermarkUpdatedAt: updates.watermarkUpdatedAt || null,
      };
      shares.set(token, next);
      return next;
    },
    async listPhotosForShare(token) {
      return [{ id: `${token}_photo`, originalPath: 'originals/p.jpg', previewPath: 'previews/p.jpg' }];
    },
    async updatePhotoWatermarkState(photoId, updates) {
      return { id: photoId, ...updates };
    },
  };
  const media = {
    async reprocessPhotoWatermark(photo) {
      return { previewPath: photo.previewPath, watermarkAppliedAt: new Date().toISOString() };
    },
  };
  const watermarkSettings = {
    async getSettings() {
      return { width: 420, height: 140, opacity: 0.55, instances: 1 };
    },
  };
  return { service: createGalleryWatermarkService({ media, repos, watermarkSettings }), shares };
}

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

test('gallery watermark falls back when custom asset is missing', async () => {
  const { service, shares } = createMemoryService();
  shares.set('share_a', { token: 'share_a', watermarkAssetId: 'missing', watermarkSettings: { width: 9999 } });

  const effective = await service.effectiveForShare('share_a');

  assert.equal(effective.kind, 'default');
  assert.equal(effective.settings.width, 900);
});

test('client image watermark payload includes access-gated asset URL', () => {
  const payload = clientWatermarkPayload({
    kind: 'image',
    settings: { width: 300, height: 120, opacity: 0.4, instances: 2 },
    asset: { id: 'asset_a', name: 'Brand A' },
    share: { token: 'share_a' },
  }, 'customer-token');

  assert.equal(payload.kind, 'image');
  assert.equal(payload.assetId, 'asset_a');
  assert.equal(payload.assetUrl, '/api/share-session/share_a/watermark/asset_a?access_token=customer-token');
});

test('gallery watermark assignment rejects assets deleted during concurrent update', async () => {
  const service = createGalleryWatermarkService({
    media: { reprocessPhotoWatermark: async () => ({}) },
    watermarkSettings: { getSettings: async () => ({ width: 420, height: 140, opacity: 0.55, instances: 1 }) },
    repos: {
      getShareSession: async () => ({ token: 'share_a', watermarkAssetId: '', watermarkSettings: {} }),
      getWatermarkAsset: async () => ({ id: 'asset_a', name: 'Brand A', storagePath: 'watermark-assets/a.png' }),
      updateShareWatermarkState: async () => null,
    },
  });

  await assert.rejects(
    () => service.assignToShare('share_a', { assetId: 'asset_a' }),
    (error) => error.status === 409 && error.code === 'watermark_asset_conflict'
  );
});

test('gallery watermark updates run sequentially per share', async () => {
  const gate = deferred();
  const updates = [];
  let reprocessCount = 0;
  const shares = new Map([['share_a', { token: 'share_a', watermarkAssetId: '', watermarkSettings: {} }]]);
  const service = createGalleryWatermarkService({
    watermarkSettings: { getSettings: async () => ({ width: 420, height: 140, opacity: 0.55, instances: 1 }) },
    repos: {
      getShareSession: async (token) => shares.get(token) || null,
      getWatermarkAsset: async (id) => ({ id, name: id, storagePath: `watermark-assets/${id}.png` }),
      updateShareWatermarkState: async (token, update) => {
        const next = {
          ...shares.get(token),
          watermarkAssetId: update.watermarkAssetId || '',
          watermarkSettings: update.watermarkSettings || {},
        };
        updates.push(next.watermarkAssetId);
        shares.set(token, next);
        return next;
      },
      listPhotosForShare: async () => [{ id: 'photo_1', originalPath: 'originals/p.jpg', previewPath: 'previews/p.jpg' }],
      updatePhotoWatermarkState: async (photoId, update) => ({ id: photoId, ...update }),
    },
    media: {
      reprocessPhotoWatermark: async (photo) => {
        reprocessCount += 1;
        if (reprocessCount === 1) await gate.promise;
        return { previewPath: photo.previewPath, watermarkAppliedAt: new Date().toISOString() };
      },
    },
  });

  const first = service.assignToShare('share_a', { assetId: 'asset_a' });
  await new Promise((resolve) => setImmediate(resolve));
  const second = service.assignToShare('share_a', { assetId: 'asset_b' });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(updates, ['asset_a']);
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(updates, ['asset_a', 'asset_b']);
});

test('random gallery watermark assignment and reset sequences stay scoped by gallery', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.constantFrom('assign_a', 'assign_b', 'clear_a', 'clear_b'), { minLength: 1, maxLength: 30 }),
      async (ops) => {
        const { service, shares } = createMemoryService();
        const expected = { share_a: '', share_b: '' };

        for (const op of ops) {
          if (op === 'assign_a') {
            await service.assignToShare('share_a', { assetId: 'asset_a', settings: { instances: 2 } });
            expected.share_a = 'asset_a';
          }
          if (op === 'assign_b') {
            await service.assignToShare('share_b', { assetId: 'asset_b', settings: { width: 250 } });
            expected.share_b = 'asset_b';
          }
          if (op === 'clear_a') {
            await service.clearFromShare('share_a');
            expected.share_a = '';
          }
          if (op === 'clear_b') {
            await service.clearFromShare('share_b');
            expected.share_b = '';
          }
        }

        assert.equal(shares.get('share_a').watermarkAssetId, expected.share_a);
        assert.equal(shares.get('share_b').watermarkAssetId, expected.share_b);
      }
    )
  );
});
