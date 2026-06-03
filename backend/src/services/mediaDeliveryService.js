const fs = require('fs/promises');
const sharp = require('sharp');
const { randomToken } = require('../tokens');
const { buildOverlaySvg } = require('./mediaOverlayService');
const {
  STORY_OVERLAY_DIMENSIONS,
  hasExplicitOverlayPlacement,
  normalizeStoryOverlayProfile,
} = require('./overlaySettingsService');
const { STORY_DELIVERY_SETUP_MESSAGE } = require('./storyDeliverySettingsService');

function hasActiveOverlay(overlay) {
  return Boolean(overlay?.enabled && overlay.kind === 'image' && overlay.assetPath);
}

function hasStoryOverlayProfile(overlay) {
  return hasActiveOverlay(overlay) && hasExplicitOverlayPlacement(overlay.asset?.storySettings);
}

async function cleanupRelativePaths(paths, absolutePath) {
  await Promise.all(paths.map((relativePath) => fs.unlink(absolutePath(relativePath)).catch(() => {})));
}

async function buildDeliveryOverlayInput(width, height, overlay, absolutePath) {
  const assetBuffer = await fs.readFile(absolutePath(overlay.assetPath));
  return buildOverlaySvg(width, height, assetBuffer, overlay.asset, overlay.settings);
}

async function buildStoryOverlayInput(overlay, absolutePath) {
  const assetBuffer = await fs.readFile(absolutePath(overlay.assetPath));
  const storySettings = normalizeStoryOverlayProfile(overlay.asset.storySettings, overlay.asset);
  return buildOverlaySvg(
    STORY_OVERLAY_DIMENSIONS.width,
    STORY_OVERLAY_DIMENSIONS.height,
    assetBuffer,
    overlay.asset,
    storySettings
  );
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

async function prepareStoryPhoto(photo, overlay, absolutePath) {
  if (!photo?.originalPath) return null;
  const outputRel = `tmp/${photo.id || 'photo'}-${randomToken(8)}-story.jpg`;
  const source = sharp(absolutePath(photo.originalPath), { sequentialRead: true }).rotate();
  const background = await source.clone()
    .resize(STORY_OVERLAY_DIMENSIONS.width, STORY_OVERLAY_DIMENSIONS.height, { fit: 'cover' })
    .blur(32)
    .modulate({ brightness: 0.72, saturation: 0.9 })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  const foreground = await source.clone()
    .resize(STORY_OVERLAY_DIMENSIONS.width, STORY_OVERLAY_DIMENSIONS.height, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      fit: 'contain',
    })
    .png()
    .toBuffer();
  await sharp(background)
    .composite([
      { input: foreground, gravity: 'center' },
      { input: await buildStoryOverlayInput(overlay, absolutePath), gravity: 'center' },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(absolutePath(outputRel));
  return {
    ...photo,
    deliveryVariant: 'story',
    originalPath: outputRel,
    sourceOriginalPath: photo.originalPath,
  };
}

function shouldPrepareStory(options = {}) {
  return options.storyDeliveryEnabled === true;
}

async function prepareDeliveryPhotos(photos = [], overlay, absolutePath, options = {}) {
  if (!hasActiveOverlay(overlay) && !shouldPrepareStory(options)) {
    return { photos, cleanup: async () => {} };
  }
  if (shouldPrepareStory(options) && !hasStoryOverlayProfile(overlay)) {
    throw new Error(STORY_DELIVERY_SETUP_MESSAGE);
  }
  const preparedPaths = [];
  try {
    const preparedPhotos = [];
    for (const photo of photos) {
      const prepared = hasActiveOverlay(overlay)
        ? await prepareDeliveryPhoto(photo, overlay, absolutePath)
        : photo;
      if (prepared.originalPath !== photo.originalPath) {
        preparedPaths.push(prepared.originalPath);
      }
      preparedPhotos.push(prepared);
      if (shouldPrepareStory(options)) {
        const storyPhoto = await prepareStoryPhoto(photo, overlay, absolutePath);
        if (storyPhoto) {
          preparedPaths.push(storyPhoto.originalPath);
          preparedPhotos.push(storyPhoto);
        }
      }
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
  prepareStoryPhoto,
};
