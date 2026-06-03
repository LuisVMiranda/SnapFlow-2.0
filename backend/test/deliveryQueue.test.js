const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');
const { createDeliveryQueue } = require('../src/services/deliveryQueue');
const { prepareDeliveryPhotos } = require('../src/services/mediaDeliveryService');

async function rgbAt(file, left, top) {
  return sharp(file)
    .raw()
    .extract({ left, top, width: 1, height: 1 })
    .toBuffer();
}

test('delivery queue uses the configured WhatsApp thank-you message', async () => {
  let claimed = false;
  let sentMessage = '';
  const repos = {
    async claimDeliveryJob() {
      if (claimed) return null;
      claimed = true;
      return { id: 7, session_id: 'sess_1' };
    },
    async getSession() {
      return { id: 'sess_1', status: 'approved', phone: '11999999999', clientName: 'Ana Cliente' };
    },
    async listPhotosForSession() {
      return [{ id: 'photo_1' }, { id: 'photo_2' }];
    },
    async updateDeliveryStatus() {},
    async completeDeliveryJob() {},
    async failDeliveryJob() {},
  };
  const whatsappTemplates = {
    async renderDeliveryThanksMessage(variables) {
      return `Obrigado ${variables.name}, pela compra de ${variables.count} foto(s)!`;
    },
  };
  const whatsapp = {
    async sendPhotos(phone, photos, storageRoot, message) {
      assert.equal(phone, '11999999999');
      assert.equal(photos.length, 2);
      assert.equal(storageRoot, 'C:/snap/storage');
      sentMessage = message;
    },
  };

  const queue = createDeliveryQueue({
    media: { storageRoot: 'C:/snap/storage' },
    repos,
    whatsapp,
    whatsappTemplates,
  });

  await queue.processOnce();

  assert.equal(sentMessage, 'Obrigado Ana Cliente, pela compra de 2 foto(s)!');
});

test('delivery queue does not send photos before manual payment approval', async () => {
  let claimed = false;
  let cancelledJob = null;
  let deliveryStatus = null;
  let sendAttempts = 0;
  const repos = {
    async claimDeliveryJob() {
      if (claimed) return null;
      claimed = true;
      return { id: 8, session_id: 'manual_pending' };
    },
    async getSession() {
      return { id: 'manual_pending', status: 'pending', paymentMethod: 'Dinheiro/Cartão', phone: '+55 11999999999' };
    },
    async listPhotosForSession() {
      return [{ id: 'photo_1' }];
    },
    async updateDeliveryStatus(sessionId, status, error) {
      deliveryStatus = { sessionId, status, error };
    },
    async completeDeliveryJob() {
      throw new Error('Entrega pendente não deveria ser concluída.');
    },
    async failDeliveryJob() {
      throw new Error('Entrega pendente deveria ser cancelada sem nova tentativa automática.');
    },
    async cancelDeliveryJob(jobId, reason) {
      cancelledJob = { jobId, reason };
    },
  };
  const whatsapp = {
    async sendPhotos() {
      sendAttempts += 1;
    },
  };

  const queue = createDeliveryQueue({
    media: { storageRoot: 'C:/snap/storage' },
    repos,
    whatsapp,
    whatsappTemplates: null,
  });

  await queue.processOnce();

  assert.equal(sendAttempts, 0);
  assert.deepEqual(deliveryStatus, { sessionId: 'manual_pending', status: 'idle', error: null });
  assert.equal(cancelledJob.jobId, 8);
  assert.match(cancelledJob.reason, /aguarda aprovação/);
});

test('delivery queue sends overlay-prepared photos for galleries with active overlay', async () => {
  let claimed = false;
  let cleanupCalled = false;
  let sentPhotos = [];
  let receivedOverlay = null;
  const repos = {
    async claimDeliveryJob() {
      if (claimed) return null;
      claimed = true;
      return { id: 9, session_id: 'sess_overlay' };
    },
    async getSession() {
      return { id: 'sess_overlay', status: 'approved', phone: '11999999999', shareToken: 'share_1' };
    },
    async listPhotosForSession() {
      return [{ id: 'photo_1', originalPath: 'originals/photo_1.jpg' }];
    },
    async updateDeliveryStatus() {},
    async completeDeliveryJob() {},
    async failDeliveryJob() {},
  };
  const media = {
    storageRoot: 'C:/snap/storage',
    async prepareDeliveryPhotos(photos, overlay) {
      receivedOverlay = overlay;
      return {
        photos: photos.map((photo) => ({ ...photo, originalPath: 'tmp/photo_1-delivery.jpg' })),
        cleanup: async () => { cleanupCalled = true; },
      };
    },
  };
  const whatsapp = {
    async sendPhotos(phone, photos) {
      assert.equal(phone, '11999999999');
      sentPhotos = photos;
    },
  };
  const galleryOverlays = {
    async effectiveForShare(token) {
      assert.equal(token, 'share_1');
      return {
        enabled: true,
        kind: 'image',
        assetPath: 'overlay-assets/overlay_1.png',
        asset: { id: 'overlay_1', storagePath: 'overlay-assets/overlay_1.png' },
        settings: { x: 0.8, y: 0.2, widthRatio: 0.4, opacity: 0.9 },
      };
    },
  };

  const queue = createDeliveryQueue({ media, repos, whatsapp, whatsappTemplates: null, galleryOverlays });

  await queue.processOnce();

  assert.equal(receivedOverlay.assetPath, 'overlay-assets/overlay_1.png');
  assert.deepEqual(receivedOverlay.settings, { x: 0.8, y: 0.2, widthRatio: 0.4, opacity: 0.9 });
  assert.deepEqual(sentPhotos.map((photo) => photo.originalPath), ['tmp/photo_1-delivery.jpg']);
  assert.equal(cleanupCalled, true);
});

test('delivery queue burns active gallery overlay into the WhatsApp document bytes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-queue-delivery-'));
  const absolutePath = (relativePath) => path.join(root, relativePath);
  await fs.mkdir(absolutePath('originals'), { recursive: true });
  await fs.mkdir(absolutePath('overlay-assets'), { recursive: true });
  await fs.mkdir(absolutePath('tmp'), { recursive: true });
  await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffffff' } })
    .jpeg()
    .toFile(absolutePath('originals/photo.jpg'));
  await sharp({ create: { width: 20, height: 20, channels: 4, background: '#ff0000' } })
    .png()
    .toFile(absolutePath('overlay-assets/asset.png'));

  let claimed = false;
  let deliveredPath = '';
  const repos = {
    async claimDeliveryJob() {
      if (claimed) return null;
      claimed = true;
      return { id: 10, session_id: 'sess_delivery_pixels' };
    },
    async getSession() {
      return { id: 'sess_delivery_pixels', status: 'approved', phone: '11999999999', shareToken: 'share_1' };
    },
    async listPhotosForSession() {
      return [{ id: 'photo_1', originalPath: 'originals/photo.jpg' }];
    },
    async updateDeliveryStatus() {},
    async completeDeliveryJob() {},
    async failDeliveryJob() {},
  };
  const galleryOverlays = {
    async effectiveForShare() {
      return {
        enabled: true,
        kind: 'image',
        assetPath: 'overlay-assets/asset.png',
        asset: { width: 20, height: 20, mimeType: 'image/png' },
        settings: { x: 0.5, y: 0.5, widthRatio: 0.5, opacity: 1 },
      };
    },
  };
  const media = {
    storageRoot: root,
    prepareDeliveryPhotos: (photos, overlay) => prepareDeliveryPhotos(photos, overlay, absolutePath),
  };
  const whatsapp = {
    async sendPhotos(phone, photos, storageRoot) {
      assert.equal(phone, '11999999999');
      assert.equal(storageRoot, root);
      assert.notEqual(photos[0].originalPath, 'originals/photo.jpg');
      deliveredPath = photos[0].originalPath;
      const deliveredPixel = await rgbAt(path.join(storageRoot, deliveredPath), 50, 50);
      assert.ok(deliveredPixel[0] > 220);
      assert.ok(deliveredPixel[1] < 40);
      assert.ok(deliveredPixel[2] < 40);
    },
  };

  const queue = createDeliveryQueue({ media, repos, whatsapp, whatsappTemplates: null, galleryOverlays });

  await queue.processOnce();

  const originalPixel = await rgbAt(absolutePath('originals/photo.jpg'), 50, 50);
  assert.ok(originalPixel[0] > 220);
  assert.ok(originalPixel[1] > 220);
  assert.ok(originalPixel[2] > 220);
  await assert.rejects(fs.stat(absolutePath(deliveredPath)), /ENOENT/);
  await fs.rm(root, { recursive: true, force: true });
});

test('delivery queue burns overlays for every payment method path', async () => {
  const cases = [
    { name: 'admin_pix', paymentMethod: 'PIX', sessionShareToken: 'share_admin_pix', photoShareToken: 'share_admin_pix' },
    { name: 'admin_manual', paymentMethod: 'Dinheiro/Cartão', sessionShareToken: 'share_admin_manual', photoShareToken: 'share_admin_manual' },
    { name: 'client_pix', paymentMethod: 'PIX', sessionShareToken: 'share_client_pix', photoShareToken: 'share_client_pix' },
    { name: 'client_manual', paymentMethod: 'Dinheiro/Cartão', sessionShareToken: 'share_client_manual', photoShareToken: 'share_client_manual' },
    { name: 'legacy_photo_token', paymentMethod: 'PIX', sessionShareToken: null, photoShareToken: 'share_from_photo' },
  ];

  for (const deliveryCase of cases) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `snapflow-${deliveryCase.name}-`));
    const absolutePath = (relativePath) => path.join(root, relativePath);
    await fs.mkdir(absolutePath('originals'), { recursive: true });
    await fs.mkdir(absolutePath('overlay-assets'), { recursive: true });
    await fs.mkdir(absolutePath('tmp'), { recursive: true });
    await sharp({ create: { width: 120, height: 160, channels: 3, background: '#ffffff' } })
      .jpeg()
      .toFile(absolutePath('originals/portrait.jpg'));
    await sharp({ create: { width: 160, height: 120, channels: 3, background: '#ffffff' } })
      .jpeg()
      .toFile(absolutePath('originals/landscape.jpg'));
    await sharp({ create: { width: 24, height: 24, channels: 4, background: '#ff0000' } })
      .png()
      .toFile(absolutePath('overlay-assets/asset.png'));

    let claimed = false;
    let overlayToken = '';
    const deliveredPaths = [];
    const repos = {
      async claimDeliveryJob() {
        if (claimed) return null;
        claimed = true;
        return { id: 30, session_id: deliveryCase.name };
      },
      async getSession() {
        return {
          id: deliveryCase.name,
          status: 'approved',
          phone: '11999999999',
          paymentMethod: deliveryCase.paymentMethod,
          shareToken: deliveryCase.sessionShareToken,
        };
      },
      async listPhotosForSession() {
        return [
          { id: `${deliveryCase.name}_portrait`, originalPath: 'originals/portrait.jpg', shareToken: deliveryCase.photoShareToken },
          { id: `${deliveryCase.name}_landscape`, originalPath: 'originals/landscape.jpg', shareToken: deliveryCase.photoShareToken },
        ];
      },
      async updateDeliveryStatus() {},
      async completeDeliveryJob() {},
      async failDeliveryJob() {},
    };
    const galleryOverlays = {
      async effectiveForShare(token) {
        overlayToken = token;
        return {
          enabled: true,
          kind: 'image',
          assetPath: 'overlay-assets/asset.png',
          asset: { width: 24, height: 24, mimeType: 'image/png' },
          settings: {
            portrait: { x: 0.5, y: 0.5, widthRatio: 0.35, opacity: 1 },
            landscape: { x: 0.5, y: 0.5, widthRatio: 0.35, opacity: 1 },
          },
        };
      },
    };
    const media = {
      storageRoot: root,
      prepareDeliveryPhotos: (photos, overlay) => prepareDeliveryPhotos(photos, overlay, absolutePath),
    };
    const whatsapp = {
      async sendPhotos(phone, photos, storageRoot) {
        assert.equal(phone, '11999999999');
        assert.equal(storageRoot, root);
        deliveredPaths.push(...photos.map((photo) => photo.originalPath));
        assert.notEqual(photos[0].originalPath, 'originals/portrait.jpg');
        assert.notEqual(photos[1].originalPath, 'originals/landscape.jpg');
        const portraitPixel = await rgbAt(path.join(storageRoot, photos[0].originalPath), 60, 80);
        const landscapePixel = await rgbAt(path.join(storageRoot, photos[1].originalPath), 80, 60);
        assert.ok(portraitPixel[0] > 220, deliveryCase.name);
        assert.ok(landscapePixel[0] > 220, deliveryCase.name);
      },
    };

    const queue = createDeliveryQueue({ media, repos, whatsapp, whatsappTemplates: null, galleryOverlays });
    await queue.processOnce();

    assert.equal(overlayToken, deliveryCase.sessionShareToken || deliveryCase.photoShareToken);
    for (const deliveredPath of deliveredPaths) {
      await assert.rejects(fs.stat(absolutePath(deliveredPath)), /ENOENT/);
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('delivery queue resolves overlay from selected photos when session share token is missing', async () => {
  let claimed = false;
  let overlayToken = '';
  let receivedOverlay = null;
  const repos = {
    async claimDeliveryJob() {
      if (claimed) return null;
      claimed = true;
      return { id: 14, session_id: 'sess_photo_share_overlay' };
    },
    async getSession() {
      return { id: 'sess_photo_share_overlay', status: 'approved', phone: '11999999999', shareToken: null };
    },
    async listPhotosForSession() {
      return [{ id: 'photo_1', originalPath: 'originals/photo_1.jpg', shareToken: 'share_from_photo' }];
    },
    async updateDeliveryStatus() {},
    async completeDeliveryJob() {},
    async failDeliveryJob() {},
  };
  const galleryOverlays = {
    async effectiveForShare(token) {
      overlayToken = token;
      return {
        enabled: true,
        kind: 'image',
        assetPath: 'overlay-assets/asset.png',
        asset: { id: 'overlay_1' },
        settings: { x: 0.5, y: 0.5, widthRatio: 0.4, opacity: 1 },
      };
    },
  };
  const media = {
    storageRoot: 'C:/snap/storage',
    async prepareDeliveryPhotos(photos, overlay) {
      receivedOverlay = overlay;
      return { photos, cleanup: async () => {} };
    },
  };
  const whatsapp = {
    async sendPhotos() {},
  };

  const queue = createDeliveryQueue({ media, repos, whatsapp, whatsappTemplates: null, galleryOverlays });

  await queue.processOnce();

  assert.equal(overlayToken, 'share_from_photo');
  assert.equal(receivedOverlay.assetPath, 'overlay-assets/asset.png');
});

test('delivery queue sends original photos when gallery overlay is inactive', async () => {
  let claimed = false;
  let receivedOverlay = 'unseen';
  let sentPhotos = [];
  const repos = {
    async claimDeliveryJob() {
      if (claimed) return null;
      claimed = true;
      return { id: 11, session_id: 'sess_no_overlay' };
    },
    async getSession() {
      return { id: 'sess_no_overlay', status: 'approved', phone: '11999999999', shareToken: 'share_1' };
    },
    async listPhotosForSession() {
      return [{ id: 'photo_1', originalPath: 'originals/photo_1.jpg' }];
    },
    async updateDeliveryStatus() {},
    async completeDeliveryJob() {},
    async failDeliveryJob() {},
  };
  const galleryOverlays = {
    async effectiveForShare() {
      return { enabled: false, kind: 'none' };
    },
  };
  const media = {
    storageRoot: 'C:/snap/storage',
    async prepareDeliveryPhotos(photos, overlay) {
      receivedOverlay = overlay;
      return { photos, cleanup: async () => {} };
    },
  };
  const whatsapp = {
    async sendPhotos(phone, photos) {
      assert.equal(phone, '11999999999');
      sentPhotos = photos;
    },
  };

  const queue = createDeliveryQueue({ media, repos, whatsapp, whatsappTemplates: null, galleryOverlays });

  await queue.processOnce();

  assert.equal(receivedOverlay, null);
  assert.deepEqual(sentPhotos.map((photo) => photo.originalPath), ['originals/photo_1.jpg']);
});

test('delivery queue sends Story copies when overlay is inactive but Stories are enabled', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-queue-story-no-overlay-'));
  const absolutePath = (relativePath) => path.join(root, relativePath);
  await fs.mkdir(absolutePath('originals'), { recursive: true });
  await fs.mkdir(absolutePath('tmp'), { recursive: true });
  await sharp({ create: { width: 800, height: 600, channels: 3, background: '#336699' } })
    .jpeg()
    .toFile(absolutePath('originals/photo.jpg'));

  let claimed = false;
  let receivedOverlay = 'unseen';
  let receivedOptions = null;
  let sentPhotos = [];
  let storyMetadata = null;
  const repos = {
    async claimDeliveryJob() {
      if (claimed) return null;
      claimed = true;
      return { id: 15, session_id: 'sess_story_no_overlay' };
    },
    async getSession() {
      return { id: 'sess_story_no_overlay', status: 'approved', phone: '11999999999', shareToken: 'share_story' };
    },
    async listPhotosForSession() {
      return [{ id: 'photo_1', originalPath: 'originals/photo.jpg' }];
    },
    async updateDeliveryStatus() {},
    async completeDeliveryJob() {},
    async failDeliveryJob() {},
  };
  const galleryOverlays = {
    async effectiveForShare(token) {
      return {
        enabled: false,
        kind: 'none',
        settings: {},
        share: { token, overlayEnabled: false, storyDeliveryEnabled: true },
      };
    },
  };
  const media = {
    storageRoot: root,
    async prepareDeliveryPhotos(photos, overlay, options) {
      receivedOverlay = overlay;
      receivedOptions = options;
      return prepareDeliveryPhotos(photos, overlay, absolutePath, options);
    },
  };
  const whatsapp = {
    async sendPhotos(phone, photos, storageRoot) {
      sentPhotos = photos;
      const storyPhoto = photos.find((photo) => photo.deliveryVariant === 'story');
      if (storyPhoto) storyMetadata = await sharp(path.join(storageRoot, storyPhoto.originalPath)).metadata();
    },
  };

  const queue = createDeliveryQueue({ media, repos, whatsapp, whatsappTemplates: null, galleryOverlays });

  try {
    await queue.processOnce();

    assert.equal(receivedOverlay, null);
    assert.equal(receivedOptions?.storyDeliveryEnabled, true);
    assert.deepEqual(sentPhotos.map((photo) => photo.originalPath), [
      'originals/photo.jpg',
      sentPhotos[1].originalPath,
    ]);
    assert.equal(sentPhotos[1].deliveryVariant, 'story');
    assert.equal(storyMetadata.width, 1080);
    assert.equal(storyMetadata.height, 1920);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('delivery queue resolves the current overlay on each delivery attempt', async () => {
  const jobs = [
    { id: 12, session_id: 'sess_retry_overlay' },
    { id: 13, session_id: 'sess_retry_overlay' },
  ];
  const receivedPositions = [];
  const repos = {
    async claimDeliveryJob() {
      return jobs.shift() || null;
    },
    async getSession() {
      return { id: 'sess_retry_overlay', status: 'approved', phone: '11999999999', shareToken: 'share_1' };
    },
    async listPhotosForSession() {
      return [{ id: 'photo_1', originalPath: 'originals/photo_1.jpg' }];
    },
    async updateDeliveryStatus() {},
    async completeDeliveryJob() {},
    async failDeliveryJob() {},
  };
  const galleryOverlays = {
    async effectiveForShare() {
      const x = receivedPositions.length ? 0.9 : 0.1;
      return {
        enabled: true,
        kind: 'image',
        assetPath: 'overlay-assets/overlay_1.png',
        asset: { id: 'overlay_1' },
        settings: { x, y: 0.5, widthRatio: 0.2, opacity: 1 },
      };
    },
  };
  const media = {
    storageRoot: 'C:/snap/storage',
    async prepareDeliveryPhotos(photos, overlay) {
      receivedPositions.push(overlay.settings.x);
      return { photos, cleanup: async () => {} };
    },
  };
  const whatsapp = {
    async sendPhotos() {},
  };

  const queue = createDeliveryQueue({ media, repos, whatsapp, whatsappTemplates: null, galleryOverlays });

  await queue.processOnce();
  await queue.processOnce();

  assert.deepEqual(receivedPositions, [0.1, 0.9]);
});
