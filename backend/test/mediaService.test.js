const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { createMediaService } = require('../src/services/mediaService');

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
