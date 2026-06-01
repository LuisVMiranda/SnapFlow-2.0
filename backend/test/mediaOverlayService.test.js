const assert = require('node:assert/strict');
const test = require('node:test');
const sharp = require('sharp');
const { buildOverlaySvg, validateOverlayAssetFile } = require('../src/services/mediaOverlayService');

async function pixelAt(buffer, left, top) {
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const index = ((top * info.width) + left) * 4;
  return [data[index], data[index + 1], data[index + 2], data[index + 3]];
}

test('overlay SVG changes preview pixels and preserves alpha behavior', async () => {
  const base = await sharp({
    create: { width: 100, height: 100, channels: 4, background: '#ffffff' },
  }).png().toBuffer();
  const overlay = await sharp({
    create: { width: 20, height: 20, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } },
  }).png().toBuffer();
  const svg = buildOverlaySvg(100, 100, overlay, { width: 20, height: 20 }, { x: 0.5, y: 0.5, widthRatio: 0.2, opacity: 1 });

  const output = await sharp(base).composite([{ input: svg, gravity: 'center' }]).png().toBuffer();
  const center = await pixelAt(output, 50, 50);
  const corner = await pixelAt(output, 2, 2);

  assert.equal(center[0] > center[1], true);
  assert.deepEqual(corner, [255, 255, 255, 255]);
});

test('overlay SVG picks placement from image orientation', async () => {
  const overlay = await sharp({
    create: { width: 20, height: 20, channels: 4, background: '#ff0000' },
  }).png().toBuffer();
  const settings = {
    portrait: { x: 0.2, y: 0.8, widthRatio: 0.2, opacity: 1 },
    landscape: { x: 0.8, y: 0.2, widthRatio: 0.2, opacity: 1 },
  };
  const portraitBase = await sharp({
    create: { width: 100, height: 140, channels: 4, background: '#ffffff' },
  }).png().toBuffer();
  const landscapeBase = await sharp({
    create: { width: 140, height: 100, channels: 4, background: '#ffffff' },
  }).png().toBuffer();

  const portrait = await sharp(portraitBase)
    .composite([{ input: buildOverlaySvg(100, 140, overlay, { width: 20, height: 20 }, settings), gravity: 'center' }])
    .png()
    .toBuffer();
  const landscape = await sharp(landscapeBase)
    .composite([{ input: buildOverlaySvg(140, 100, overlay, { width: 20, height: 20 }, settings), gravity: 'center' }])
    .png()
    .toBuffer();

  assert.equal((await pixelAt(portrait, 20, 112))[0] > 220, true);
  assert.equal((await pixelAt(landscape, 112, 20))[0] > 220, true);
});

test('overlay upload validation rejects bad mime and large files', () => {
  assert.throws(
    () => validateOverlayAssetFile({ mimetype: 'image/gif', originalname: 'bad.gif', size: 12 }),
    (error) => error.status === 400 && error.code === 'overlay_asset_invalid_type'
  );
  assert.throws(
    () => validateOverlayAssetFile({ mimetype: 'image/png', originalname: 'huge.png', size: 6 * 1024 * 1024 }),
    (error) => error.status === 413 && error.code === 'overlay_asset_too_large'
  );
});
