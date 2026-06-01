const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');
const { prepareDeliveryPhotos } = require('../src/services/mediaDeliveryService');

async function rgbAt(file, left, top) {
  return sharp(file)
    .raw()
    .extract({ left, top, width: 1, height: 1 })
    .toBuffer();
}

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
  const pixel = await rgbAt(absolutePath(prepared.photos[0].originalPath), 50, 50);
  assert.ok(pixel[0] > 220);
  assert.ok(pixel[1] < 40);
  assert.ok(pixel[2] < 40);
  await prepared.cleanup();
  await assert.rejects(fs.stat(absolutePath(prepared.photos[0].originalPath)), /ENOENT/);
  await fs.rm(root, { recursive: true, force: true });
});

test('delivery overlay uses portrait and landscape placement profiles', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-delivery-orientation-'));
  const absolutePath = (relativePath) => path.join(root, relativePath);
  await fs.mkdir(absolutePath('originals'), { recursive: true });
  await fs.mkdir(absolutePath('overlay-assets'), { recursive: true });
  await fs.mkdir(absolutePath('tmp'), { recursive: true });
  await sharp({
    create: { width: 100, height: 140, channels: 3, background: '#ffffff' },
  }).jpeg().toFile(absolutePath('originals/portrait.jpg'));
  await sharp({
    create: { width: 140, height: 100, channels: 3, background: '#ffffff' },
  }).jpeg().toFile(absolutePath('originals/landscape.jpg'));
  await sharp({
    create: { width: 20, height: 20, channels: 4, background: '#ff0000' },
  }).png().toFile(absolutePath('overlay-assets/asset.png'));

  const prepared = await prepareDeliveryPhotos(
    [
      { id: 'portrait', originalPath: 'originals/portrait.jpg' },
      { id: 'landscape', originalPath: 'originals/landscape.jpg' },
    ],
    {
      enabled: true,
      kind: 'image',
      assetPath: 'overlay-assets/asset.png',
      asset: { width: 20, height: 20, mimeType: 'image/png' },
      settings: {
        portrait: { x: 0.2, y: 0.8, widthRatio: 0.2, opacity: 1 },
        landscape: { x: 0.8, y: 0.2, widthRatio: 0.2, opacity: 1 },
      },
    },
    absolutePath
  );

  const portraitPixel = await rgbAt(absolutePath(prepared.photos[0].originalPath), 20, 112);
  const landscapePixel = await rgbAt(absolutePath(prepared.photos[1].originalPath), 112, 20);
  assert.ok(portraitPixel[0] > 220);
  assert.ok(landscapePixel[0] > 220);

  await prepared.cleanup();
  await fs.rm(root, { recursive: true, force: true });
});
