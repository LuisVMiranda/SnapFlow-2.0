const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { buildWatermarkSvg, createMediaService } = require('../src/services/mediaService');

test('media service processes small PNG uploads without watermark dimension failures', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-media-'));
  const input = path.join(root, 'small.png');
  await sharp({
    create: {
      width: 320,
      height: 240,
      channels: 4,
      background: '#1e90ff',
    },
  }).png().toFile(input);

  const media = createMediaService({
    storageRoot: root,
    maxUploadMb: 25,
    maxFilesPerUpload: 100,
    publicBaseUrl: 'http://localhost:5174',
  });

  const [photo] = await media.processUploadedFiles([
    { path: input, originalname: 'small.png', mimetype: 'image/png' },
  ]);

  assert.equal(photo.mimeType, 'image/jpeg');
  assert.ok(photo.originalPath.startsWith('originals/'));
  await assert.doesNotReject(fs.access(path.join(root, photo.previewPath)));
});

test('watermark SVG repeats SnapFlow according to settings', () => {
  const svg = buildWatermarkSvg(800, 600, {
    width: 360,
    height: 120,
    opacity: 0.4,
    instances: 5,
  }).toString('utf8');

  assert.equal((svg.match(/SnapFlow/g) || []).length, 5);
  assert.match(svg, /rgba\(255,255,255,0.4\)/);
});

test('media service asks for current watermark settings when generating previews', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-media-watermark-'));
  const input = path.join(root, 'custom-watermark.png');
  await sharp({
    create: {
      width: 320,
      height: 240,
      channels: 4,
      background: '#00c851',
    },
  }).png().toFile(input);

  let calls = 0;
  const media = createMediaService(
    {
      storageRoot: root,
      maxUploadMb: 25,
      maxFilesPerUpload: 100,
      publicBaseUrl: 'http://localhost:5174',
    },
    {
      watermarkSettings: {
        getSettings: async () => {
          calls += 1;
          return {
            width: 300,
            height: 110,
            opacity: 0.35,
            instances: 3,
          };
        },
      },
    }
  );

  await media.processUploadedFiles([
    { path: input, originalname: 'custom-watermark.png', mimetype: 'image/png' },
  ]);

  assert.equal(calls, 1);
});
