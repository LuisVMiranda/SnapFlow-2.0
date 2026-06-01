const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const {
  clientOverlayPayload,
  createGalleryOverlayService,
} = require('../src/services/galleryOverlayService');

function createMemoryService() {
  const shares = new Map([
    ['share_a', { token: 'share_a', overlayAssetId: '', overlayEnabled: false, overlaySettings: {} }],
    ['share_b', { token: 'share_b', overlayAssetId: '', overlayEnabled: false, overlaySettings: {} }],
  ]);
  const assets = new Map([
    ['asset_a', { id: 'asset_a', identifier: 'Brand A', storagePath: 'overlay-assets/a.png' }],
    ['asset_b', { id: 'asset_b', identifier: 'Brand B', storagePath: 'overlay-assets/b.png' }],
  ]);
  const repos = {
    async getShareSession(token) {
      return shares.get(token) || null;
    },
    async getOverlayAsset(id) {
      return assets.get(id) || null;
    },
    async updateShareOverlayState(token, updates) {
      if (!assets.has(updates.overlayAssetId) && updates.overlayAssetId) return null;
      const next = {
        ...shares.get(token),
        overlayAssetId: updates.overlayAssetId || '',
        overlayEnabled: Boolean(updates.overlayEnabled),
        overlaySettings: updates.overlaySettings || {},
      };
      shares.set(token, next);
      return next;
    },
    async listPhotosForShare(token) {
      return [{ id: `${token}_photo`, originalPath: 'originals/p.jpg', previewPath: 'previews/p.jpg' }];
    },
    async updatePhotoOverlayState(photoId, updates) {
      return { id: photoId, ...updates };
    },
  };
  const media = {
    async reprocessPhotoOverlay(photo) {
      return { previewPath: photo.previewPath, overlayAppliedAt: new Date().toISOString() };
    },
  };
  return { service: createGalleryOverlayService({ media, repos }), shares };
}

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

test('gallery overlay resolver handles no asset, disabled asset, and enabled asset', async () => {
  const { service, shares } = createMemoryService();
  assert.equal((await service.effectiveForShare('share_a')).enabled, false);

  shares.set('share_a', { token: 'share_a', overlayAssetId: 'asset_a', overlayEnabled: false, overlaySettings: { opacity: 0.4 } });
  assert.equal((await service.effectiveForShare('share_a')).enabled, false);

  shares.set('share_a', { token: 'share_a', overlayAssetId: 'asset_a', overlayEnabled: true, overlaySettings: { opacity: 0.4 } });
  const effective = await service.effectiveForShare('share_a');
  assert.equal(effective.enabled, true);
  assert.equal(effective.asset.identifier, 'Brand A');
});

test('client overlay payload includes access-gated asset URL', () => {
  const payload = clientOverlayPayload({
    enabled: true,
    kind: 'image',
    settings: { x: 0.2, y: 0.3, widthRatio: 0.4, opacity: 0.5 },
    asset: { id: 'asset_a', identifier: 'Brand A' },
    share: { token: 'share_a' },
  }, 'customer-token');

  assert.equal(payload.enabled, true);
  assert.equal(payload.assetId, 'asset_a');
  assert.equal(payload.assetUrl, '/api/share-session/share_a/overlay/asset_a?access_token=customer-token');
});

test('gallery overlay toggle preserves assignment and settings', async () => {
  const { service, shares } = createMemoryService();

  await service.assignToShare('share_a', { assetId: 'asset_a', settings: { opacity: 0.4 } });
  await service.assignToShare('share_a', { enabled: false });

  const share = shares.get('share_a');
  assert.equal(share.overlayAssetId, 'asset_a');
  assert.equal(share.overlayEnabled, false);
  assert.equal(share.overlaySettings.opacity, 0.4);
});

test('gallery overlay assignment rejects assets deleted during concurrent update', async () => {
  const service = createGalleryOverlayService({
    media: { reprocessPhotoOverlay: async () => ({}) },
    repos: {
      getShareSession: async () => ({ token: 'share_a', overlayAssetId: '', overlayEnabled: false, overlaySettings: {} }),
      getOverlayAsset: async () => ({ id: 'asset_a', identifier: 'Brand A', storagePath: 'overlay-assets/a.png' }),
      updateShareOverlayState: async () => null,
    },
  });

  await assert.rejects(
    () => service.assignToShare('share_a', { assetId: 'asset_a' }),
    (error) => error.status === 409 && error.code === 'overlay_asset_conflict'
  );
});

test('gallery overlay updates run sequentially per share', async () => {
  const gate = deferred();
  const updates = [];
  let reprocessCount = 0;
  const { service, shares } = createMemoryService();
  const originalUpdate = service;
  shares.set('share_a', { token: 'share_a', overlayAssetId: '', overlayEnabled: false, overlaySettings: {} });
  const repos = {
    getShareSession: async (token) => shares.get(token) || null,
    getOverlayAsset: async (id) => ({ id, identifier: id, storagePath: `overlay-assets/${id}.png` }),
    updateShareOverlayState: async (token, update) => {
      const next = { ...shares.get(token), overlayAssetId: update.overlayAssetId, overlayEnabled: update.overlayEnabled, overlaySettings: update.overlaySettings };
      updates.push(next.overlayAssetId);
      shares.set(token, next);
      return next;
    },
    listPhotosForShare: async () => [{ id: 'photo_1', originalPath: 'originals/p.jpg', previewPath: 'previews/p.jpg' }],
    updatePhotoOverlayState: async (photoId, update) => ({ id: photoId, ...update }),
  };
  const queuedService = createGalleryOverlayService({
    repos,
    media: {
      reprocessPhotoOverlay: async (photo) => {
        reprocessCount += 1;
        if (reprocessCount === 1) await gate.promise;
        return { previewPath: photo.previewPath, overlayAppliedAt: new Date().toISOString() };
      },
    },
  });

  assert.equal(typeof originalUpdate.assignToShare, 'function');
  const first = queuedService.assignToShare('share_a', { assetId: 'asset_a' });
  await new Promise((resolve) => setImmediate(resolve));
  const second = queuedService.assignToShare('share_a', { assetId: 'asset_b' });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(updates, ['asset_a']);
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(updates, ['asset_a', 'asset_b']);
});

test('random overlay assignment/toggle/remove sequences stay scoped by gallery', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.constantFrom('assign_a', 'assign_b', 'off_a', 'remove_b'), { minLength: 1, maxLength: 30 }),
      async (ops) => {
        const { service, shares } = createMemoryService();
        const expected = { share_a: { id: '', enabled: false }, share_b: { id: '', enabled: false } };

        for (const op of ops) {
          if (op === 'assign_a') {
            await service.assignToShare('share_a', { assetId: 'asset_a', settings: { x: 0.1 } });
            expected.share_a = { id: 'asset_a', enabled: true };
          }
          if (op === 'assign_b') {
            await service.assignToShare('share_b', { assetId: 'asset_b', settings: { y: 0.9 } });
            expected.share_b = { id: 'asset_b', enabled: true };
          }
          if (op === 'off_a' && expected.share_a.id) {
            await service.assignToShare('share_a', { enabled: false });
            expected.share_a.enabled = false;
          }
          if (op === 'remove_b') {
            await service.clearFromShare('share_b');
            expected.share_b = { id: '', enabled: false };
          }
        }

        assert.equal(shares.get('share_a').overlayAssetId, expected.share_a.id);
        assert.equal(shares.get('share_a').overlayEnabled, expected.share_a.enabled);
        assert.equal(shares.get('share_b').overlayAssetId, expected.share_b.id);
        assert.equal(shares.get('share_b').overlayEnabled, expected.share_b.enabled);
      }
    )
  );
});
