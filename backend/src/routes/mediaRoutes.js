const express = require('express');
const { safeEqual } = require('../auth');
const { HttpError, asyncHandler } = require('../errors');
const { validateCustomerAccess } = require('../services/shareAccess');

function createMediaRouter({ auth, config, media, repos }) {
  const router = express.Router();

  router.get(
    '/media/:photoId/:variant',
    asyncHandler(async (req, res) => {
      if (!['thumb', 'preview'].includes(req.params.variant)) {
        throw new HttpError(404, 'Variante de mídia não encontrada. Atualize a página e tente abrir a foto novamente.', 'media_variant_not_found');
      }
      const photo = await repos.getPhoto(req.params.photoId);
      if (!photo) throw new HttpError(404, 'Foto não encontrada. Ela pode ter sido removida pela retenção ou pela edição da galeria.', 'photo_not_found');
      const adminToken = req.query.admin_token || '';
      const hasAdminMediaAccess = config.adminAccessToken && safeEqual(adminToken, config.adminAccessToken);
      if (!hasAdminMediaAccess) validateCustomerAccess(req, photo.shareToken);
      await media.sendFile(res, photo, req.params.variant);
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
