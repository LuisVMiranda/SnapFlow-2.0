const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { hashValue } = require('../src/tokens');

function createOverlayAssetTestApp() {
  let assetCounter = 0;
  const assets = new Map();
  const photos = [{ id: 'photo_1', shareToken: 'share_1', mediaVersion: '', originalPath: 'originals/photo_1.jpg', previewPath: 'previews/photo_1.jpg' }];
  const shares = new Map([['share_1', {
    token: 'share_1',
    galleryId: 'gallery_1',
    galleryName: 'Gallery X',
    accessCodeHash: hashValue('1234'),
    accessCode: '1234',
    packageType: 'eventos',
    phone: '11999999999',
    photoCount: 1,
    subtotal: 10,
    discountAmount: 0,
    total: 10,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    status: 'active',
    link: 'http://localhost:5173/s/share_1',
    overlayAssetId: '',
    overlayEnabled: false,
    overlaySettings: {},
    watermarkAssetId: '',
    watermarkSettings: {},
  }]]);
  const repos = {
    listOverlayAssets: async () => Array.from(assets.values()).filter((asset) => !asset.deletedAt),
    getOverlayAsset: async (id) => assets.get(id) && !assets.get(id).deletedAt ? assets.get(id) : null,
    createOverlayAsset: async (asset) => {
      const stored = { ...asset, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      assets.set(asset.id, stored);
      return stored;
    },
    updateOverlayAsset: async (id, updates) => {
      const stored = { ...assets.get(id), ...updates, updatedAt: new Date().toISOString() };
      assets.set(id, stored);
      return stored;
    },
    countOverlayAssetAssignments: async (id) => Array.from(shares.values()).filter((share) => share.overlayAssetId === id).length,
    deleteOverlayAsset: async (id) => {
      if (Array.from(shares.values()).some((share) => share.overlayAssetId === id)) return null;
      const stored = { ...assets.get(id), deletedAt: new Date().toISOString() };
      assets.set(id, stored);
      return stored;
    },
    getShareSession: async (token) => shares.get(token) || null,
    markShareAccessGranted: async (token) => shares.get(token),
    getShareCart: async () => [],
    listPhotosForShare: async (token) => photos.filter((photo) => photo.shareToken === token),
    listPhotosForSharePage: async (token) => ({
      items: photos.filter((photo) => photo.shareToken === token),
      page: { hasMore: false, nextCursor: null, loadedCount: 1, totalCount: 1 },
    }),
    updatePhotoOverlayState: async (photoId, updates) => {
      const photo = photos.find((item) => item.id === photoId);
      Object.assign(photo, updates, { mediaVersion: updates.overlayAppliedAt });
      return photo;
    },
    updateShareOverlayState: async (token, updates) => {
      const share = {
        ...shares.get(token),
        overlayAssetId: updates.overlayAssetId || '',
        overlayEnabled: Boolean(updates.overlayEnabled),
        overlaySettings: updates.overlaySettings || {},
        overlayUpdatedAt: updates.overlayUpdatedAt || null,
      };
      shares.set(token, share);
      return share;
    },
  };
  return createApp({
    config: {
      adminAccessToken: 'admin-secret',
      maxFilesPerUpload: 5,
      maxUploadMb: 1,
      publicBaseUrl: 'http://localhost:5173',
    },
    repos,
    media: {
      tempDir: () => __dirname,
      maxUploadBytes: 1024,
      allowedMimeTypes: new Set(['image/jpeg']),
      allowedOverlayMimeTypes: new Set(['image/png']),
      allowedWatermarkMimeTypes: new Set(['image/png']),
      maxOverlayAssetBytes: 1024 * 1024,
      maxWatermarkAssetBytes: 1024 * 1024,
      processOverlayAssetUpload: async (file) => {
        await fs.unlink(file.path).catch(() => {});
        assetCounter += 1;
        return {
          id: `overlay_${assetCounter}`,
          originalFilename: file.originalname,
          storagePath: `overlay-assets/overlay_${assetCounter}.png`,
          mimeType: 'image/png',
          width: 120,
          height: 80,
          sizeBytes: file.size || 12,
          checksum: `checksum_${assetCounter}`,
        };
      },
      reprocessPhotoOverlay: async (photo) => ({
        previewPath: photo.previewPath,
        overlayAppliedAt: new Date().toISOString(),
        watermarkAppliedAt: new Date().toISOString(),
      }),
      removeOverlayAsset: async () => {},
      sendOverlayAsset: async (res, asset) => res.type('png').send(`overlay:${asset.id}`),
    },
    payment: {},
    credentials: {},
    deliveryQueue: {},
    packages: { getSettings: async () => ({ eventos: { unit: 10, bulk: 8, threshold: 5 } }) },
    retention: {},
    whatsapp: {},
    whatsappTemplates: {},
  });
}

test('admin can upload, assign, toggle, clear, and expose gallery overlay asset after unlock', async () => {
  const app = createOverlayAssetTestApp();

  const created = await request(app)
    .post('/api/admin/overlay-assets')
    .set('Authorization', 'Bearer admin-secret')
    .field('identifier', 'Brand Overlay')
    .attach('asset', Buffer.from('fake-png'), { filename: 'overlay.png', contentType: 'image/png' });

  assert.equal(created.status, 201);
  assert.equal(created.body.identifier, 'Brand Overlay');
  assert.equal(created.body.url, '/api/admin/overlay-assets/overlay_1/file');

  const assigned = await request(app)
    .patch('/api/admin/share-sessions/share_1/overlay')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      assetId: created.body.id,
      enabled: true,
      settings: { x: 0.25, y: 0.75, widthRatio: 0.5, opacity: 0.4 },
    });

  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.changedPhotoCount, 1);
  assert.equal(assigned.body.overlayAsset.id, created.body.id);

  const toggled = await request(app)
    .patch('/api/admin/share-sessions/share_1/overlay')
    .set('Authorization', 'Bearer admin-secret')
    .send({ enabled: false });
  assert.equal(toggled.status, 200);
  assert.equal(toggled.body.share.overlayEnabled, false);
  assert.equal(toggled.body.share.overlaySettings.opacity, 0.4);

  const unlocked = await request(app).post('/api/share-session/share_1/unlock').send({ code: '1234' });
  assert.equal(unlocked.status, 200);
  assert.equal(unlocked.body.overlaySettings.enabled, false);

  await request(app)
    .patch('/api/admin/share-sessions/share_1/overlay')
    .set('Authorization', 'Bearer admin-secret')
    .send({ enabled: true });
  const unlockedActive = await request(app).post('/api/share-session/share_1/unlock').send({ code: '1234' });
  assert.equal(unlockedActive.body.overlaySettings.enabled, true);
  assert.match(unlockedActive.body.overlaySettings.assetUrl, /access_token=/);

  const blockedWrongToken = await request(app).get('/api/share-session/share_1/overlay/overlay_1?access_token=bad');
  assert.equal(blockedWrongToken.status, 403);

  const assetResponse = await request(app).get(unlockedActive.body.overlaySettings.assetUrl);
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.text || assetResponse.body.toString('utf8'), /overlay:overlay_1/);

  const blockedDelete = await request(app)
    .delete(`/api/admin/overlay-assets/${created.body.id}`)
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(blockedDelete.status, 409);

  const cleared = await request(app)
    .delete('/api/admin/share-sessions/share_1/overlay')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.overlayAsset, null);

  const deleted = await request(app)
    .delete(`/api/admin/overlay-assets/${created.body.id}`)
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(deleted.status, 200);
});
