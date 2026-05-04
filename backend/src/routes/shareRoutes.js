const express = require('express');
const { HttpError, asyncHandler } = require('../errors');
const { randomToken } = require('../tokens');
const { toPhotoIds } = require('./helpers');
const {
  isExpired,
  issueCustomerAccessToken,
  publicSharePayload,
  validateAccessCode,
  validateCustomerAccess,
} = require('../services/shareAccess');

function calculateTotal(count, packageType, packageOptions) {
  const pricing = packageOptions[packageType] || packageOptions[Object.keys(packageOptions)[0]];
  const unit = count >= pricing.threshold ? pricing.bulk : pricing.unit;
  return { unit, total: count * unit };
}

async function resolveShareOrder({ packages, repos, req }) {
  const share = await repos.getShareSession(req.params.token);
  if (!share) throw new HttpError(404, 'Link não encontrado.', 'share_not_found');
  if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado.', 'share_expired');
  validateCustomerAccess(req, share.token);

  const requestedPhotoIds = toPhotoIds(req.body.photoIds || req.body.photos);
  if (!requestedPhotoIds.length) {
    throw new HttpError(400, 'Selecione ao menos uma foto para pagar.', 'photos_required');
  }

  const sharePhotos = await repos.listPhotosForShare(share.token);
  const allowedIds = new Set(sharePhotos.map((photo) => photo.id));
  const photoIds = requestedPhotoIds.filter((photoId) => allowedIds.has(photoId));
  if (photoIds.length !== requestedPhotoIds.length) {
    throw new HttpError(403, 'Uma ou mais fotos não pertencem a esta galeria.', 'photo_share_mismatch');
  }

  const packageOptions = await packages.getSettings();
  const count = photoIds.length;
  const { total } = calculateTotal(count, share.packageType, packageOptions);
  return { count, photoIds, share, total };
}

function createShareRouter({ packages, payment, repos }) {
  const router = express.Router();

  router.get(
    '/share-session/:token',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token);
      if (!share) throw new HttpError(404, 'Link não encontrado.', 'share_not_found');
      res.json(publicSharePayload(share));
    })
  );

  router.post(
    '/share-session/:token/unlock',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token, { includeSensitive: true });
      if (!share) throw new HttpError(404, 'Link não encontrado.', 'share_not_found');
      if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado.', 'share_expired');
      if (!validateAccessCode(req.body.code, share.accessCodeHash)) {
        throw new HttpError(401, 'Código inválido.', 'invalid_share_code');
      }
      await repos.markShareAccessGranted(share.token);
      const photos = await repos.listPhotosForShare(share.token);
      const customerAccessToken = issueCustomerAccessToken(share.token);
      res.json({
        ...publicSharePayload(share),
        customerAccessToken,
        photos: photos.map((photo) => ({
          id: photo.id,
          url: `/api/media/${photo.id}/preview?access_token=${customerAccessToken}`,
          thumbUrl: `/api/media/${photo.id}/thumb?access_token=${customerAccessToken}`,
        })),
      });
    })
  );

  router.post(
    '/share-session/:token/pix',
    asyncHandler(async (req, res) => {
      const order = await resolveShareOrder({ packages, repos, req });
      const sessionId = req.body.sessionId || `share_${order.share.token}_${randomToken(8)}`;
      const pix = await payment.createPixPayment({
        sessionId,
        total: order.total,
        count: order.count,
        phone: order.share.phone,
        packageType: order.share.packageType,
        photoIds: order.photoIds,
        shareToken: order.share.token,
      });
      res.json({ ...pix, sessionId });
    })
  );

  router.post(
    '/share-session/:token/manual-payment',
    asyncHandler(async (req, res) => {
      const order = await resolveShareOrder({ packages, repos, req });
      const sessionId = req.body.sessionId || `share_${order.share.token}_${randomToken(8)}`;
      const session = await repos.createSession(
        {
          id: sessionId,
          amount: order.total,
          photoCount: order.count,
          packageType: order.share.packageType,
          phone: order.share.phone,
          status: 'pending',
          paymentMethod: 'Dinheiro/Cartão',
          shareToken: order.share.token,
          deliveryStatus: 'idle',
        },
        order.photoIds
      );
      res.json({ status: session.status, deliveryStatus: session.deliveryStatus, paymentMethod: session.paymentMethod });
    })
  );

  return router;
}

module.exports = { createShareRouter };
