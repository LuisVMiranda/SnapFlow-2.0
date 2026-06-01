const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

function createManualSaleGalleryApp() {
  let share = null;
  let session = null;
  let photos = [{ id: 'photo_1', shareToken: null, sessionId: null }];
  const repos = {
    createShareSession: async (payload) => {
      share = {
        token: payload.token,
        accessCode: payload.accessCode,
        galleryName: payload.galleryName,
        clientName: payload.clientName,
        phone: payload.phone,
        photoCount: payload.photoIds.length,
        total: payload.total,
      };
      photos = photos.map((photo) => (
        payload.photoIds.includes(photo.id) ? { ...photo, shareToken: payload.token } : photo
      ));
      return share;
    },
    createSession: async (payload, photoIds) => {
      session = { ...payload };
      photos = photos.map((photo) => (
        photoIds.includes(photo.id) ? { ...photo, sessionId: payload.id } : photo
      ));
      return session;
    },
    deleteDetachedShareDuplicates: async () => [],
    findShareWithExactPhotos: async () => null,
    recordConversionEvent: async () => null,
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
    media: {
      tempDir: () => __dirname,
      maxUploadBytes: 1024,
      allowedMimeTypes: new Set(['image/jpeg']),
    },
    payment: {},
    credentials: { getSecretValue: async () => '' },
    deliveryQueue: { enqueue: async () => null },
    packages: {},
    retention: {},
    whatsapp: {},
    whatsappTemplates: {},
  });
  return { app, state: () => ({ photos, session, share }) };
}

test('direct admin cash sale creates a manageable gallery before delivery', async () => {
  const { app, state } = createManualSaleGalleryApp();

  const response = await request(app)
    .post('/api/admin/manual-payment')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      packageType: 'eventos',
      count: 1,
      subtotal: 10,
      total: 10,
      sessionId: 'manual_1',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'pending');
  assert.ok(response.body.shareToken);
  assert.equal(state().share.token, response.body.shareToken);
  assert.equal(state().share.galleryName, 'Venda - Ana Cliente');
  assert.equal(state().session.shareToken, response.body.shareToken);
  assert.equal(state().photos[0].shareToken, response.body.shareToken);
  assert.equal(state().photos[0].sessionId, 'manual_1');
});
