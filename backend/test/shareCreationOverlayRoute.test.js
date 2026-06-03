const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

function createOverlayCreationApp({ storySettings = {} } = {}) {
  const overlayAsset = {
    id: 'overlay_1',
    identifier: 'Logo evento',
    storagePath: 'overlay-assets/overlay_1.png',
    storySettings,
  };
  let share = null;
  let photos = [{
    id: 'photo_1',
    shareToken: null,
    previewPath: 'previews/photo_1.jpg',
    thumbPath: 'thumbs/photo_1.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    sizeBytes: 100,
  }];
  const repos = {
    findShareWithExactPhotos: async () => null,
    createShareSession: async (payload) => {
      share = {
        token: payload.token,
        galleryId: payload.galleryId || payload.token,
        accessCode: payload.accessCode,
        accessCodeHash: payload.accessCodeHash,
        phone: payload.phone,
        clientName: payload.clientName || '',
        clientEmail: payload.clientEmail || '',
        galleryName: payload.galleryName || '',
        galleryDescription: payload.galleryDescription || '',
        packageType: payload.packageType,
        photoCount: payload.photoIds.length,
        subtotal: payload.subtotal,
        discountAmount: payload.discountAmount,
        total: payload.total,
        expiresAt: payload.expiresAt.toISOString(),
        link: payload.link,
        overlayAssetId: '',
        overlayEnabled: false,
        overlaySettings: {},
        storyDeliveryEnabled: Boolean(payload.storyDeliveryEnabled),
        sales: { soldPhotoCount: 0, soldOrderCount: 0, soldAmount: 0, lastSoldAt: null },
      };
      photos = photos.map((photo) => (
        payload.photoIds.includes(photo.id) ? { ...photo, shareToken: payload.token } : photo
      ));
      return share;
    },
    deleteDetachedShareDuplicates: async () => [],
    getShareSession: async (token) => (share?.token === token ? share : null),
    getOverlayAsset: async (id) => (id === overlayAsset.id ? overlayAsset : null),
    listPhotosForShare: async (token) => photos.filter((photo) => photo.shareToken === token),
    updateShareOverlayState: async (token, updates) => {
      if (share?.token !== token || updates.overlayAssetId !== overlayAsset.id) return null;
      share = {
        ...share,
        overlayAssetId: updates.overlayAssetId,
        overlayEnabled: Boolean(updates.overlayEnabled),
        overlaySettings: updates.overlaySettings || {},
        overlayUpdatedAt: updates.overlayUpdatedAt,
      };
      return share;
    },
    updatePhotoOverlayState: async (photoId, updates) => {
      let updatedPhoto = null;
      photos = photos.map((photo) => {
        if (photo.id !== photoId) return photo;
        updatedPhoto = { ...photo, ...updates };
        return updatedPhoto;
      });
      return updatedPhoto;
    },
  };
  const media = {
    tempDir: () => __dirname,
    maxUploadBytes: 1024,
    allowedMimeTypes: new Set(['image/jpeg']),
    reprocessPhotoOverlay: async (photo, overlay) => ({
      previewPath: photo.previewPath,
      overlayAppliedAt: overlay.enabled ? '2026-01-01T00:01:00.000Z' : null,
      watermarkAppliedAt: '2026-01-01T00:01:00.000Z',
    }),
  };
  const app = createApp({
    config: {
      adminAccessToken: 'admin-secret',
      maxFilesPerUpload: 10,
      maxUploadMb: 1,
      defaultGalleryRetentionDays: 30,
      publicBaseUrl: 'http://localhost:5173',
    },
    repos,
    media,
    payment: {},
    credentials: { getSecretValue: async () => '' },
    deliveryQueue: { enqueue: async () => null },
    packages: {},
    retention: {},
    whatsapp: { sendText: async () => {} },
    whatsappTemplates: {
      renderShareLinkMessage: async ({ link, accessCode }) => `Abra ${link}\nCodigo ${accessCode}`,
    },
  });
  return { app, state: () => ({ share, photos }) };
}

test('admin can apply an existing overlay during gallery creation', async () => {
  const { app, state } = createOverlayCreationApp();

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      packageType: 'eventos',
      count: 1,
      subtotal: 10,
      total: 10,
      expiresMinutes: 30,
      overlayAssetId: 'overlay_1',
      overlaySettings: { x: 0.2, y: 0.8, widthRatio: 0.4, opacity: 0.7 },
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.overlayAssetId, 'overlay_1');
  assert.equal(response.body.overlayEnabled, true);
  assert.equal(state().share.overlayAssetId, 'overlay_1');
  assert.equal(state().share.overlayEnabled, true);
  assert.equal(state().share.overlaySettings.x, 0.2);
  assert.equal(state().share.overlaySettings.y, 0.8);
  assert.equal(state().share.overlaySettings.widthRatio, 0.4);
  assert.equal(state().share.overlaySettings.opacity, 0.7);
  assert.deepEqual(state().share.overlaySettings.portrait, { x: 0.2, y: 0.8, widthRatio: 0.4, opacity: 0.7 });
  assert.deepEqual(state().share.overlaySettings.landscape, { x: 0.2, y: 0.8, widthRatio: 0.4, opacity: 0.7 });
  assert.equal(state().photos[0].overlayAppliedAt, '2026-01-01T00:01:00.000Z');
});

test('admin cannot enable story delivery until the overlay has a story profile', async () => {
  const { app } = createOverlayCreationApp();

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      packageType: 'eventos',
      count: 1,
      subtotal: 10,
      total: 10,
      expiresMinutes: 30,
      overlayAssetId: 'overlay_1',
      overlaySettings: { x: 0.2, y: 0.8, widthRatio: 0.4, opacity: 0.7 },
      storyDeliveryEnabled: true,
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'story_overlay_profile_required');
  assert.match(response.body.error, /Configure primeiro o overlay para Stories/);
});

test('admin cannot enable story delivery with a disabled overlay request', async () => {
  const { app } = createOverlayCreationApp({
    storySettings: { x: 0.5, y: 0.9, widthRatio: 0.25, opacity: 1 },
  });

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      packageType: 'eventos',
      count: 1,
      subtotal: 10,
      total: 10,
      expiresMinutes: 30,
      overlayAssetId: 'overlay_1',
      overlayEnabled: false,
      storyDeliveryEnabled: true,
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'story_overlay_profile_required');
});

test('admin can enable story delivery during gallery creation with a story overlay profile', async () => {
  const { app, state } = createOverlayCreationApp({
    storySettings: { x: 0.5, y: 0.9, widthRatio: 0.25, opacity: 1 },
  });

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      packageType: 'eventos',
      count: 1,
      subtotal: 10,
      total: 10,
      expiresMinutes: 30,
      overlayAssetId: 'overlay_1',
      overlaySettings: { x: 0.2, y: 0.8, widthRatio: 0.4, opacity: 0.7 },
      storyDeliveryEnabled: true,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.storyDeliveryEnabled, true);
  assert.equal(state().share.storyDeliveryEnabled, true);
});
