const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');
const { prepareDeliveryPhotos } = require('../src/services/mediaDeliveryService');

test('delivery overlay is composited into final sent image', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-delivery-'));
  const absolutePath = (relativePath) => path.join(root, relativePath);
  await fs.mkdir(absolutePath('originals'), { recursive: true });
  await fs.mkdir(absolutePath('overlay-assets'), { recursive: true });
  await fs.mkdir(absolutePath('tmp'), { recursive: true });
  await sharp({
    create: { width: 100, height: 100, channels: 3, background: '#ffffff' },
  }).jpeg().toFile(absolutePath('originals/photo.jpg'));
  await sharp({
    create: { width: 20, height: 20, channels: 4, background: '#ff0000' },
  }).png().toFile(absolutePath('overlay-assets/asset.png'));

  const prepared = await prepareDeliveryPhotos(
    [{ id: 'photo_1', originalPath: 'originals/photo.jpg' }],
    {
      enabled: true,
      kind: 'image',
      assetPath: 'overlay-assets/asset.png',
      asset: { width: 20, height: 20 },
      settings: { x: 0.5, y: 0.5, widthRatio: 0.5, opacity: 1 },
    },
    absolutePath
  );

  assert.notEqual(prepared.photos[0].originalPath, 'originals/photo.jpg');
  const pixel = await sharp(absolutePath(prepared.photos[0].originalPath))
    .raw()
    .extract({ left: 50, top: 50, width: 1, height: 1 })
    .toBuffer();
  assert.ok(pixel[0] > 220);
  assert.ok(pixel[1] < 40);
  assert.ok(pixel[2] < 40);
  await prepared.cleanup();
  await assert.rejects(fs.stat(absolutePath(prepared.photos[0].originalPath)), /ENOENT/);
  await fs.rm(root, { recursive: true, force: true });
});
