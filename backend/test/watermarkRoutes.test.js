const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { hashValue } = require('../src/tokens');
const { createWatermarkSettingsService } = require('../src/services/watermarkSettingsService');

function createWatermarkTestApp() {
  let settings = {};
  const repos = {
    getSettings: async () => settings,
    upsertSettings: async (nextSettings) => {
      settings = { ...settings, ...nextSettings };
      return settings;
    },
    getShareSession: async (token) => {
      if (token !== 'share_1') return null;
      return {
        token,
        accessCodeHash: hashValue('1234'),
        packageType: 'eventos',
        phone: '11999999999',
        clientName: 'Ana Cliente',
        clientEmail: '',
        photoCount: 1,
        total: 10,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        revokedAt: null,
        status: 'active',
        link: 'http://localhost:5173/s/share_1',
      };
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
    },
    payment: {},
    credentials: {},
    deliveryQueue: {},
    packages: {},
    retention: {},
    whatsapp: {},
    whatsappTemplates: {},
    watermark,
  });
}

test('admin watermark settings route saves preview watermark controls', async () => {
  const response = await request(createWatermarkTestApp())
    .put('/api/admin/settings/watermark')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      width: 360,
      height: 120,
      opacity: 0.4,
      instances: 6,
    });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    width: 360,
    height: 120,
    opacity: 0.4,
    instances: 6,
  });
});

test('public share metadata includes watermark settings for client overlays', async () => {
  const app = createWatermarkTestApp();
  await request(app)
    .put('/api/admin/settings/watermark')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      width: 500,
      height: 160,
      opacity: 0.35,
      instances: 4,
    });

  const response = await request(app).get('/api/share-session/share_1');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.watermarkSettings, {
    width: 500,
    height: 160,
    opacity: 0.35,
    instances: 4,
  });
  assert.equal(response.body.photos, undefined);
});
