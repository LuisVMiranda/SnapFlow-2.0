const express = require('express');
const { safeEqual } = require('../auth');
const { HttpError, asyncHandler } = require('../errors');
const { validateCustomerAccess } = require('../services/shareAccess');

function createMediaRouter({ auth, config, media, repos }) {
  const router = express.Router();

  function hasAdminMediaAccess(req) {
    const header = req.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    const candidate = req.query.admin_token || match?.[1] || '';
    return Boolean(config.adminAccessToken && safeEqual(candidate, config.adminAccessToken));
  }

  router.get(
    '/media/:photoId/:variant',
    asyncHandler(async (req, res) => {
      if (!['thumb', 'preview'].includes(req.params.variant)) {
        throw new HttpError(404, 'Variante de mídia não encontrada. Atualize a página e tente abrir a foto novamente.', 'media_variant_not_found');
      }
      const photo = await repos.getPhoto(req.params.photoId);
      if (!photo) throw new HttpError(404, 'Foto não encontrada. Ela pode ter sido removida pela retenção ou pela edição da galeria.', 'photo_not_found');
      if (!hasAdminMediaAccess(req)) validateCustomerAccess(req, photo.shareToken);
      await media.sendFile(res, photo, req.params.variant);
    })
  );

  router.get(
    '/admin/overlay-assets/:assetId/file',
    asyncHandler(async (req, res) => {
      if (!hasAdminMediaAccess(req)) {
        throw new HttpError(403, 'Acesso administrativo invalido para visualizar o overlay.', 'admin_required');
      }
      const asset = typeof repos.getOverlayAsset === 'function'
        ? await repos.getOverlayAsset(req.params.assetId)
        : null;
      if (!asset) throw new HttpError(404, 'Overlay não encontrado.', 'overlay_asset_not_found');
      await media.sendOverlayAsset(res, asset);
    })
  );

  router.get(
    '/admin/watermark-assets/:assetId/file',
    asyncHandler(async (req, res) => {
      if (!hasAdminMediaAccess(req)) {
        throw new HttpError(403, "Acesso administrativo inválido para visualizar a marca d'água.", 'admin_required');
      }
      const asset = typeof repos.getWatermarkAsset === 'function'
        ? await repos.getWatermarkAsset(req.params.assetId)
        : null;
      if (!asset) throw new HttpError(404, "Marca d'água não encontrada.", 'watermark_asset_not_found');
      await media.sendWatermarkAsset(res, asset);
    })
  );

  router.get(
    '/admin/media/:photoId/original',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const photo = await repos.getPhoto(req.params.photoId);
      if (!photo) throw new HttpError(404, 'Foto não encontrada. Ela pode ter sido removida pela retenção ou pela edição da galeria.', 'photo_not_found');
      await media.sendFile(res, photo, 'original');
    })
  );

  return router;
}

module.exports = { createMediaRouter };
