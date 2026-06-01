const { HttpError } = require('../errors');
const { overlayPlacementForDimensions } = require('./overlaySettingsService');

const OVERLAY_ASSET_MAX_BYTES = 5 * 1024 * 1024;
const OVERLAY_ASSET_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function validateOverlayAssetFile(file) {
  if (!file) {
    throw new HttpError(400, 'Envie uma imagem para criar o overlay.', 'overlay_asset_required');
  }
  if (!OVERLAY_ASSET_MIME_TYPES.has(file.mimetype)) {
    throw new HttpError(
      400,
      `Tipo de overlay não permitido para "${file.originalname}". Envie PNG, JPG ou WebP.`,
      'overlay_asset_invalid_type',
      {
        fileName: file.originalname,
        receivedType: file.mimetype,
        allowedTypes: Array.from(OVERLAY_ASSET_MIME_TYPES),
      }
    );
  }
  if (Number(file.size || 0) > OVERLAY_ASSET_MAX_BYTES) {
    throw new HttpError(413, 'O overlay deve ter até 5 MB.', 'overlay_asset_too_large');
  }
}

function overlayDimensions(imageWidth, asset, settings) {
  const naturalWidth = Math.max(1, Number(asset?.width || 1));
  const naturalHeight = Math.max(1, Number(asset?.height || 1));
  const width = Math.max(1, Math.round(Number(imageWidth || 1) * settings.widthRatio));
  return {
    width,
    height: Math.max(1, Math.round(width * (naturalHeight / naturalWidth))),
  };
}

function buildOverlaySvg(width, height, assetBuffer, asset = {}, rawSettings = {}) {
  const settings = overlayPlacementForDimensions(rawSettings, width, height);
  const size = overlayDimensions(width, asset, settings);
  const left = Math.round((width * settings.x) - (size.width / 2));
  const top = Math.round((height * settings.y) - (size.height / 2));
  const encoded = assetBuffer.toString('base64');
  const mimeType = asset?.mimeType || 'image/png';
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <image href="data:${mimeType};base64,${encoded}" x="${left}" y="${top}" width="${size.width}" height="${size.height}" opacity="${settings.opacity}" preserveAspectRatio="xMidYMid meet"/>
    </svg>
  `);
}

module.exports = {
  OVERLAY_ASSET_MAX_BYTES,
  OVERLAY_ASSET_MIME_TYPES,
  buildOverlaySvg,
  validateOverlayAssetFile,
};
