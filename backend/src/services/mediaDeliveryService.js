const fs = require('fs/promises');
const sharp = require('sharp');
const { randomToken } = require('../tokens');
const { buildOverlaySvg } = require('./mediaOverlayService');

function hasActiveOverlay(overlay) {
  return Boolean(overlay?.enabled && overlay.kind === 'image' && overlay.assetPath);
}

async function cleanupRelativePaths(paths, absolutePath) {
  await Promise.all(paths.map((relativePath) => fs.unlink(absolutePath(relativePath)).catch(() => {})));
}

async function buildDeliveryOverlayInput(width, height, overlay, absolutePath) {
  const assetBuffer = await fs.readFile(absolutePath(overlay.assetPath));
  return buildOverlaySvg(width, height, assetBuffer, overlay.asset, overlay.settings);
}

async function prepareDeliveryPhoto(photo, overlay, absolutePath) {
  if (!photo?.originalPath) return photo;
  const outputRel = `tmp/${photo.id || 'photo'}-${randomToken(8)}-delivery.jpg`;
  const source = await sharp(absolutePath(photo.originalPath), { sequentialRead: true })
    .toBuffer({ resolveWithObject: true });
  await sharp(source.data)
    .composite([{
      input: await buildDeliveryOverlayInput(source.info.width, source.info.height, overlay, absolutePath),
      gravity: 'center',
    }])
    .jpeg({ quality: 94, mozjpeg: true })
    .toFile(absolutePath(outputRel));
  return { ...photo, originalPath: outputRel, sourceOriginalPath: photo.originalPath };
}

async function prepareDeliveryPhotos(photos = [], overlay, absolutePath) {
  if (!hasActiveOverlay(overlay)) {
    return { photos, cleanup: async () => {} };
  }
  const preparedPaths = [];
  try {
    const preparedPhotos = [];
    for (const photo of photos) {
      const prepared = await prepareDeliveryPhoto(photo, overlay, absolutePath);
      if (prepared.originalPath !== photo.originalPath) preparedPaths.push(prepared.originalPath);
      preparedPhotos.push(prepared);
    }
    return {
      photos: preparedPhotos,
      cleanup: () => cleanupRelativePaths(preparedPaths, absolutePath),
    };
  } catch (error) {
    await cleanupRelativePaths(preparedPaths, absolutePath);
    throw error;
  }
}

module.exports = {
  prepareDeliveryPhoto,
  prepareDeliveryPhotos,
};
