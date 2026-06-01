const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createWatermarkSettingsService } = require('../src/services/watermarkSettingsService');
const { hashValue } = require('../src/tokens');

function createWatermarkAssetTestApp() {
  let settings = {};
  let assetCounter = 0;
  const assets = new Map();
  const photos = [{ id: 'photo_1', shareToken: 'share_1', mediaVersion: '', originalPath: 'originals/photo_1.jpg', previewPath: 'previews/photo_1.jpg' }];
  const shares = new Map([
    ['share_1', {
      token: 'share_1',
      galleryId: 'gallery_1',
      galleryName: 'Gallery X',
      galleryDescription: '',
      accessCodeHash: hashValue('1234'),
      accessCode: '1234',
      packageType: 'eventos',
      phone: '11999999999',
      clientName: 'Ana Cliente',
      clientEmail: '',
      photoCount: 1,
      subtotal: 10,
      discountAmount: 0,
      total: 10,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revokedAt: null,
      status: 'active',
      link: 'http://localhost:5173/s/share_1',
      watermarkAssetId: '',
      watermarkSettings: {},
    }],
  ]);
  const repos = {
    getSettings: async () => settings,
    upsertSettings: async (nextSettings) => {
      settings = { ...settings, ...nextSettings };
      return settings;
    },
    listWatermarkAssets: async () => Array.from(assets.values()).filter((asset) => !asset.deletedAt),
    getWatermarkAsset: async (id) => assets.get(id) && !assets.get(id).deletedAt ? assets.get(id) : null,
    createWatermarkAsset: async (asset) => {
      const stored = {
        ...asset,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      assets.set(asset.id, stored);
      return stored;
    },
    updateWatermarkAsset: async (id, updates) => {
      const stored = { ...assets.get(id), ...updates, updatedAt: new Date().toISOString() };
      assets.set(id, stored);
      return stored;
    },
    countWatermarkAssetAssignments: async (id) => Array.from(shares.values()).filter((share) => share.watermarkAssetId === id).length,
    deleteWatermarkAsset: async (id) => {
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
    updatePhotoWatermarkState: async (photoId, updates) => {
      const photo = photos.find((item) => item.id === photoId);
      Object.assign(photo, updates, { mediaVersion: updates.watermarkAppliedAt });
      return photo;
    },
    updateShareWatermarkState: async (token, updates) => {
      const share = {
        ...shares.get(token),
        watermarkAssetId: updates.watermarkAssetId || '',
        watermarkSettings: updates.watermarkSettings || {},
        watermarkUpdatedAt: updates.watermarkUpdatedAt || null,
      };
      shares.set(token, share);
      return share;
    },
  };
  const watermark = createWatermarkSettingsService({ repos });
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
      allowedWatermarkMimeTypes: new Set(['image/png']),
      maxWatermarkAssetBytes: 1024 * 1024,
      processWatermarkAssetUpload: async (file) => {
        await fs.unlink(file.path).catch(() => {});
        assetCounter += 1;
        return {
          id: `asset_${assetCounter}`,
          originalFilename: file.originalname,
          storagePath: `watermark-assets/asset_${assetCounter}.png`,
          mimeType: 'image/png',
          width: 120,
          height: 80,
          sizeBytes: file.size || 12,
          checksum: `checksum_${assetCounter}`,
        };
      },
      reprocessPhotoWatermark: async (photo) => ({
        previewPath: photo.previewPath,
        watermarkAppliedAt: new Date().toISOString(),
      }),
      removeWatermarkAsset: async () => {},
      sendWatermarkAsset: async (res, asset) => res.type('png').send(`asset:${asset.id}`),
    },
    payment: {},
    credentials: {},
    deliveryQueue: {},
    packages: { getSettings: async () => ({ eventos: { unit: 10, bulk: 8, threshold: 5 } }) },
    retention: {},
    whatsapp: {},
    whatsappTemplates: {},
    watermark,
  });
}

test('admin can upload, assign and expose a gallery watermark asset after unlock', async () => {
  const app = createWatermarkAssetTestApp();

  const created = await request(app)
    .post('/api/admin/watermark-assets')
    .set('Authorization', 'Bearer admin-secret')
    .field('name', 'Brand X')
    .attach('asset', Buffer.from('fake-png'), { filename: 'brand.png', contentType: 'image/png' });

  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'Brand X');
  assert.equal(created.body.url, '/api/admin/watermark-assets/asset_1/file');

  const assigned = await request(app)
    .patch('/api/admin/share-sessions/share_1/watermark')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      assetId: created.body.id,
      settings: { width: 320, height: 120, opacity: 0.45, instances: 2 },
    });

  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.changedPhotoCount, 1);
  assert.equal(assigned.body.watermarkAsset.id, created.body.id);

  const blockedDelete = await request(app)
    .delete(`/api/admin/watermark-assets/${created.body.id}`)
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(blockedDelete.status, 409);
  assert.equal(blockedDelete.body.code, 'watermark_asset_in_use');

  const unlocked = await request(app)
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  assert.equal(unlocked.status, 200);
  assert.equal(unlocked.body.watermarkSettings.kind, 'image');
  assert.match(unlocked.body.watermarkSettings.assetUrl, /access_token=/);

  const assetResponse = await request(app).get(unlocked.body.watermarkSettings.assetUrl);
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.text || assetResponse.body.toString('utf8'), /asset:asset_1/);

  const cleared = await request(app)
    .delete('/api/admin/share-sessions/share_1/watermark')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.watermarkAsset, null);

  const deleted = await request(app)
    .delete(`/api/admin/watermark-assets/${created.body.id}`)
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(deleted.status, 200);
});
