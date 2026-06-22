const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { hashValue } = require('../src/tokens');

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

async function createDownloadApp({ deliveryMode = 'both' } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-downloads-'));
  await fs.mkdir(path.join(root, 'originals'), { recursive: true });
  await fs.writeFile(path.join(root, 'originals/photo_1.jpg'), Buffer.from('photo-bytes'));

  const photo = {
    id: 'photo_1',
    shareToken: 'share_1',
    originalPath: 'originals/photo_1.jpg',
    thumbPath: 'originals/photo_1.jpg',
    previewPath: 'originals/photo_1.jpg',
    createdAt: new Date().toISOString(),
  };
  const share = {
    token: 'share_1',
    accessCodeHash: hashValue('1234'),
    accessCode: '1234',
    deliveryMode,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    packageType: 'eventos',
    phone: '11999999999',
    photoCount: 1,
    subtotal: 15,
    discountAmount: 0,
    total: 15,
    status: 'active',
    sales: { soldPhotoCount: 1, soldOrderCount: 1, soldAmount: 15, lastSoldAt: new Date().toISOString() },
  };
  let savedCart = [];
  const repos = {
    getSettings: async () => ({}),
    upsertSettings: async (settings) => settings,
    getShareSession: async () => share,
    markShareAccessGranted: async () => share,
    getShareCart: async () => ['photo_1'],
    saveShareCart: async (token, photoIds) => {
      savedCart = photoIds;
      return savedCart;
    },
    listDownloadEntitlementPhotoIds: async () => ['photo_1'],
    listDownloadEntitledPhotos: async () => [photo],
    getDownloadEntitledPhoto: async () => photo,
    listPhotosForSharePage: async () => ({
      items: [photo],
      page: { limit: 40, hasMore: false, nextCursor: null, loadedCount: 1, totalCount: 1 },
    }),
    listPhotosForShareByIds: async (token, photoIds) => photoIds.includes('photo_1') ? [photo] : [],
  };
  const media = {
    storageRoot: root,
    allowedMimeTypes: new Set(['image/jpeg']),
    absolutePath: (relativePath) => path.join(root, relativePath),
    maxFiles: 5,
    maxUploadBytes: 1024 * 1024,
    prepareDeliveryPhotos: async (photos) => ({ photos, cleanup: async () => {} }),
    tempDir: () => path.join(root, 'tmp'),
  };
  const app = createApp({
    config: { adminAccessToken: 'admin-secret', maxFilesPerUpload: 5, maxUploadMb: 1, storageRoot: root },
    repos,
    media,
    payment: {},
    deliveryQueue: { enqueue: async () => null },
    retention: { getSettings: async () => ({}), updateSettings: async () => ({}) },
    packages: { getSettings: async () => ({ eventos: { unit: 15, bulk: 10, threshold: 3 } }) },
    credentials: { getSecretValue: async () => '' },
    whatsapp: {},
    whatsappTemplates: {},
    watermark: { getSettings: async () => ({}) },
    galleryOverlays: {
      clientOverlayPayload: () => ({ enabled: false }),
      effectiveForShare: async () => ({ enabled: false, kind: 'none', share }),
    },
    galleryWatermarks: { effectiveForShare: async () => ({}), clientWatermarkPayload: () => ({}) },
    storyDelivery: { getSettings: async () => ({}), updateSettings: async () => ({}) },
  });
  return { app, root, savedCart: () => savedCart };
}

test('share unlock marks purchased photos as visible, unselectable and downloadable', async () => {
  const { app, root } = await createDownloadApp();
  try {
    const response = await request(app)
      .post('/api/share-session/share_1/unlock')
      .send({ code: '1234' });

    assert.equal(response.status, 200);
    assert.equal(response.body.photos[0].purchased, true);
    assert.equal(response.body.photos[0].selectable, false);
    assert.match(response.body.photos[0].downloadUrl, /\/download\/photo_1/);
    assert.equal(response.body.downloads.purchasedCount, 1);
    assert.match(response.body.downloads.downloadAllUrl, /download-all/);
    assert.deepEqual(response.body.cartPhotoIds, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('share cart ignores purchased photos before saving', async () => {
  const { app, root, savedCart } = await createDownloadApp();
  try {
    const unlock = await request(app)
      .post('/api/share-session/share_1/unlock')
      .send({ code: '1234' });

    const response = await request(app)
      .post('/api/share-session/share_1/cart')
      .set('Authorization', `Bearer ${unlock.body.customerAccessToken}`)
      .send({ photoIds: ['photo_1'] });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.cartPhotoIds, []);
    assert.deepEqual(savedCart(), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('share download endpoints return final individual file and download-all zip', async () => {
  const { app, root } = await createDownloadApp();
  try {
    const unlock = await request(app)
      .post('/api/share-session/share_1/unlock')
      .send({ code: '1234' });
    const token = unlock.body.customerAccessToken;

    const single = await request(app)
      .get('/api/share-session/share_1/download/photo_1')
      .query({ access_token: token });
    assert.equal(single.status, 200);
    assert.equal(single.body.toString('utf8'), 'photo-bytes');

    const archive = await request(app)
      .get('/api/share-session/share_1/download-all')
      .query({ access_token: token })
      .buffer(true)
      .parse(binaryParser);
    assert.equal(archive.status, 200);
    assert.equal(archive.body.subarray(0, 2).toString('utf8'), 'PK');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('download URLs are hidden when gallery mode is WhatsApp only', async () => {
  const { app, root } = await createDownloadApp({ deliveryMode: 'whatsapp' });
  try {
    const unlock = await request(app)
      .post('/api/share-session/share_1/unlock')
      .send({ code: '1234' });

    assert.equal(unlock.status, 200);
    assert.equal(unlock.body.photos[0].purchased, true);
    assert.equal(unlock.body.photos[0].downloadUrl, '');
    assert.equal(unlock.body.downloads.enabled, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
