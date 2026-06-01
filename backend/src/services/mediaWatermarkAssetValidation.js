const { HttpError } = require('../errors');

const WATERMARK_ASSET_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const WATERMARK_ASSET_MAX_BYTES = 5 * 1024 * 1024;

function validateWatermarkAssetFile(file) {
  if (!file) {
    throw new HttpError(400, "Envie uma imagem para criar a marca d'água.", 'watermark_asset_required');
  }
  if (!WATERMARK_ASSET_MIME_TYPES.has(file.mimetype)) {
    throw new HttpError(400, "Tipo de marca d'água não permitido. Envie PNG, JPG ou WebP.", 'watermark_asset_invalid_type');
  }
  if (file.size && file.size > WATERMARK_ASSET_MAX_BYTES) {
    throw new HttpError(413, "A marca d'água deve ter até 5 MB.", 'watermark_asset_too_large');
  }
}

module.exports = {
  WATERMARK_ASSET_MAX_BYTES,
  WATERMARK_ASSET_MIME_TYPES,
  validateWatermarkAssetFile,
};
