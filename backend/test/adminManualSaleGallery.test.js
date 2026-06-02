const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

function createManualSaleGalleryApp() {
  let share = null;
  let session = null;
  let paymentPayload = null;
  let overlayAssignment = null;
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
        expiresAt: payload.expiresAt,
        retentionExpiresAt: payload.retentionExpiresAt,
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
    payment: {
      createPixPayment: async (payload) => {
        paymentPayload = payload;
        await repos.createSession(
          {
            id: payload.sessionId,
            amount: payload.total,
            subtotal: payload.subtotal,
            discountAmount: payload.discountAmount,
            photoCount: payload.count,
            packageType: payload.packageType,
            phone: payload.phone,
            clientName: payload.clientName,
            clientEmail: payload.clientEmail,
            status: 'pending',
            paymentMethod: 'PIX',
            paymentId: 'pay_1',
            shareToken: payload.shareToken || null,
            deliveryStatus: 'idle',
          },
          payload.photoIds
        );
        return { qr_code_base64: 'pix-base64', qr_code: 'pix-code', payment_id: 'pay_1' };
      },
    },
    credentials: { getSecretValue: async () => '' },
    deliveryQueue: { enqueue: async () => null },
    galleryOverlays: {
      assignToShare: async (token, payload) => {
        overlayAssignment = { token, payload };
        share = {
          ...share,
          overlayAssetId: payload.assetId,
          overlayEnabled: Boolean(payload.enabled),
          overlaySettings: payload.settings || {},
        };
        return { share, changedPhotoCount: photos.filter((photo) => photo.shareToken === token).length };
      },
    },
    packages: {},
    retention: {},
    whatsapp: {},
    whatsappTemplates: {},
  });
  return { app, state: () => ({ overlayAssignment, paymentPayload, photos, session, share }) };
}

test('direct admin cash sale creates a manageable gallery before delivery', async () => {
  const { app, state } = createManualSaleGalleryApp();
  const startedAt = Date.now();

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
  const expiresDeltaMinutes = Math.round((new Date(state().share.expiresAt).getTime() - startedAt) / 60_000);
  assert.equal(expiresDeltaMinutes, 30);
  assert.ok(new Date(state().share.retentionExpiresAt).getTime() - startedAt > 20 * 24 * 60 * 60 * 1000);
  assert.equal(state().session.shareToken, response.body.shareToken);
  assert.equal(state().photos[0].shareToken, response.body.shareToken);
  assert.equal(state().photos[0].sessionId, 'manual_1');
});

test('direct admin Pix sale creates a gallery and saves overlay before delivery', async () => {
  const { app, state } = createManualSaleGalleryApp();

  const response = await request(app)
    .post('/api/admin/pix')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      packageType: 'eventos',
      count: 1,
      subtotal: 10,
      total: 10,
      sessionId: 'pix_1',
      overlayAssetId: 'overlay_1',
      overlaySettings: {
        portrait: { x: 0.2, y: 0.8, widthRatio: 0.35, opacity: 0.8 },
        landscape: { x: 0.7, y: 0.3, widthRatio: 0.45, opacity: 0.9 },
      },
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.qr_code_base64, 'pix-base64');
  assert.ok(response.body.shareToken);
  assert.equal(state().share.token, response.body.shareToken);
  assert.equal(state().paymentPayload.shareToken, response.body.shareToken);
  assert.equal(state().session.shareToken, response.body.shareToken);
  assert.equal(state().photos[0].shareToken, response.body.shareToken);
  assert.equal(state().photos[0].sessionId, 'pix_1');
  assert.deepEqual(state().overlayAssignment, {
    token: response.body.shareToken,
    payload: {
      assetId: 'overlay_1',
      enabled: true,
      settings: {
        portrait: { x: 0.2, y: 0.8, widthRatio: 0.35, opacity: 0.8 },
        landscape: { x: 0.7, y: 0.3, widthRatio: 0.45, opacity: 0.9 },
      },
    },
  });
});
