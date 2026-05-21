const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const {
  ALLOWED_MIME_TYPES,
  AUTO_ENHANCE_PRESETS,
  adaptiveAutoEnhancePreset,
  buildWatermarkSvg,
  createMediaService,
  mapWithConcurrency,
} = require('../src/services/mediaService');

async function fileSha256(filePath) {
  return crypto
    .createHash('sha256')
    .update(await fs.readFile(filePath))
    .digest('hex');
}

async function imageMean(filePath) {
  const stats = await sharp(filePath, { sequentialRead: true }).removeAlpha().stats();
  const channels = stats.channels.slice(0, 3);
  return channels.reduce((sum, channel) => sum + Number(channel.mean || 0), 0) / channels.length;
}

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
  assert.ok(photo.sourcePath.startsWith('sources/'));
  assert.ok(photo.originalPath.startsWith('originals/'));
  await assert.doesNotReject(fs.access(path.join(root, photo.sourcePath)));
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

test('media service can run lightweight auto enhance during upload', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-media-enhance-'));
  const input = path.join(root, 'enhance.png');
  await sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: '#6f6f6f',
    },
  }).png().toFile(input);

  const logs = [];
  const originalLog = console.log;
  console.log = (message) => logs.push(String(message));
  try {
    const media = createMediaService({
      storageRoot: root,
      maxUploadMb: 25,
      maxFilesPerUpload: 100,
      publicBaseUrl: 'http://localhost:5174',
      autoEnhanceEnabled: true,
      autoEnhanceLevel: 'cinematic',
    });

    const [photo] = await media.processUploadedFiles([
      { path: input, originalname: 'enhance.png', mimetype: 'image/png' },
    ]);

    assert.ok(logs.some((message) => message.includes('[AUTO_ENHANCE] Processing image enhance.png')));
    await assert.doesNotReject(fs.access(path.join(root, photo.originalPath)));
    await assert.doesNotReject(fs.access(path.join(root, photo.thumbPath)));
    await assert.doesNotReject(fs.access(path.join(root, photo.previewPath)));
  } finally {
    console.log = originalLog;
  }
});

test('media service stores applied photo preset metadata during upload', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-media-preset-'));
  const input = path.join(root, 'preset.png');
  await sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: '#777777',
    },
  }).png().toFile(input);

  const media = createMediaService({
    storageRoot: root,
    maxUploadMb: 25,
    maxFilesPerUpload: 100,
    publicBaseUrl: 'http://localhost:5174',
    autoEnhanceEnabled: false,
  });

  const presetStack = [{
    id: 'evento-interno',
    name: 'Evento interno',
    settings: {
      brightness: 1.08,
      contrast: 1.12,
      saturation: 1.05,
      sharpen: 1,
      jpegQuality: 90,
    },
  }];

  const [photo] = await media.processUploadedFiles([
    { path: input, originalname: 'preset.png', mimetype: 'image/png' },
  ], null, { presetStack });

  assert.deepEqual(photo.appliedPresetIds, ['evento-interno']);
  assert.deepEqual(photo.appliedPresetSnapshot, presetStack);
  assert.ok(photo.presetAppliedAt);
  await assert.doesNotReject(fs.access(path.join(root, photo.sourcePath)));
  await assert.doesNotReject(fs.access(path.join(root, photo.originalPath)));
});

test('media service reprocesses preset variants from the preserved source file', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-media-reprocess-preset-'));
  const input = path.join(root, 'dark.png');
  await sharp({
    create: {
      width: 160,
      height: 120,
      channels: 3,
      background: '#404040',
    },
  }).png().toFile(input);

  const media = createMediaService({
    storageRoot: root,
    maxUploadMb: 25,
    maxFilesPerUpload: 100,
    publicBaseUrl: 'http://localhost:5174',
    autoEnhanceEnabled: false,
  });

  const [photo] = await media.processUploadedFiles([
    { path: input, originalname: 'dark.png', mimetype: 'image/png' },
  ]);
  const sourceAbs = path.join(root, photo.sourcePath);
  const originalAbs = path.join(root, photo.originalPath);
  const sourceHashBefore = await fileSha256(sourceAbs);
  const sourceMean = await imageMean(sourceAbs);
  const originalChecksumBefore = photo.checksum;

  const processed = await media.reprocessPhotoWithPresets(photo, [{
    id: 'exposicao-alta',
    name: 'Exposição alta',
    settings: {
      exposure: 1,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      gamma: 1,
      jpegQuality: 92,
    },
  }]);

  assert.equal(await fileSha256(sourceAbs), sourceHashBefore);
  assert.equal(processed.originalPath, photo.originalPath);
  assert.deepEqual(processed.appliedPresetIds, ['exposicao-alta']);
  assert.notEqual(processed.checksum, originalChecksumBefore);
  assert.ok(processed.sizeBytes > 0);
  assert.ok(await imageMean(originalAbs) > sourceMean + 20);
});

test('adaptive auto enhance protects dark photos from heavy contrast', () => {
  const darkPreset = adaptiveAutoEnhancePreset('balanced', {
    channels: [{ mean: 55 }, { mean: 58 }, { mean: 52 }],
  });
  const regularPreset = adaptiveAutoEnhancePreset('balanced', {
    channels: [{ mean: 130 }, { mean: 132 }, { mean: 128 }],
  });

  assert.equal(darkPreset.mode, 'low_light');
  assert.ok(darkPreset.brightness > regularPreset.brightness);
  assert.ok(darkPreset.intercept > 0);
  assert.ok(darkPreset.contrast < regularPreset.contrast);
});

test('media service accepts modern phone image MIME types', () => {
  assert.equal(ALLOWED_MIME_TYPES.has('image/heic'), true);
  assert.equal(ALLOWED_MIME_TYPES.has('image/heif'), true);
});

test('upload processing concurrency keeps order while limiting parallel work', async () => {
  let active = 0;
  let maxActive = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return item * 10;
  });

  assert.deepEqual(result, [10, 20, 30, 40, 50]);
  assert.equal(maxActive, 2);
});

test('auto enhance presets keep balanced stronger than soft', () => {
  assert.ok(AUTO_ENHANCE_PRESETS.balanced.brightness > AUTO_ENHANCE_PRESETS.soft.brightness);
  assert.ok(AUTO_ENHANCE_PRESETS.cinematic.contrast > AUTO_ENHANCE_PRESETS.balanced.contrast);
});
