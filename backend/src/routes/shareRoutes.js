const express = require('express');
const { HttpError, asyncHandler } = require('../errors');
const { applyManualDiscount } = require('../services/discounts');
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
  return {
    unit,
    subtotal: count * unit,
    threshold: Number(pricing.threshold || 0),
  };
}

function accessTokenFromRequest(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return req.query.access_token || req.query.token || match?.[1] || '';
}

function sharePhotoPayload(photo, customerAccessToken) {
  return {
    id: photo.id,
    url: `/api/media/${photo.id}/preview?access_token=${customerAccessToken}`,
    thumbUrl: `/api/media/${photo.id}/thumb?access_token=${customerAccessToken}`,
  };
}

async function recordConversion(repos, event) {
  if (typeof repos.recordConversionEvent !== 'function') return;
  try {
    await repos.recordConversionEvent(event);
  } catch (error) {
    console.warn(`Falha ao registrar evento de conversao: ${error.message}`);
  }
}

async function resolveShareOrder({ packages, repos, req }) {
  const share = await repos.getShareSession(req.params.token);
  if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para conferir a galeria no painel e enviar um link atualizado.', 'share_not_found');
  if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado. Peça ao fotógrafo para recriar ou estender o acesso à galeria.', 'share_expired');
  validateCustomerAccess(req, share.token);

  const requestedPhotoIds = toPhotoIds(req.body.photoIds || req.body.photos);
  if (!requestedPhotoIds.length) {
    throw new HttpError(400, 'Selecione ao menos uma foto para pagar.', 'photos_required');
  }

  const sharePhotos = await repos.listPhotosForShareByIds(share.token, requestedPhotoIds);
  const photoIds = sharePhotos.map((photo) => photo.id);
  if (photoIds.length !== requestedPhotoIds.length) {
    throw new HttpError(403, 'Uma ou mais fotos não pertencem a esta galeria. Atualize a página e selecione as fotos novamente.', 'photo_share_mismatch');
  }

  const packageOptions = await packages.getSettings();
  const count = photoIds.length;
  const { subtotal } = calculateTotal(count, share.packageType, packageOptions);
  const totals = applyManualDiscount(subtotal, share.discountAmount);
  return { count, photoIds, share, ...totals };
}

function createShareRouter({ packages, payment, repos, watermark }) {
  const router = express.Router();

  async function publicPayload(share) {
    const payload = publicSharePayload(share);
    if (watermark && typeof watermark.getSettings === 'function') {
      payload.watermarkSettings = await watermark.getSettings();
    }
    return payload;
  }

  router.get(
    '/share-session/:token',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token);
      if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para enviar um link atualizado.', 'share_not_found');
      await recordConversion(repos, { type: 'share_opened', shareToken: share.token, photoCount: share.photoCount });
      res.json(await publicPayload(share));
    })
  );

  router.post(
    '/share-session/:token/unlock',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token, { includeSensitive: true });
      if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para enviar um link atualizado.', 'share_not_found');
      if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado. Peça ao fotógrafo para recriar ou estender o acesso à galeria.', 'share_expired');
      if (!validateAccessCode(req.body.code, share.accessCodeHash)) {
        throw new HttpError(401, 'Código inválido. Digite os 4 caracteres enviados pelo fotógrafo e tente novamente.', 'invalid_share_code');
      }
      await repos.markShareAccessGranted(share.token);
      await recordConversion(repos, { type: 'share_unlocked', shareToken: share.token, photoCount: share.photoCount });
      const { items, page } = await repos.listPhotosForSharePage(share.token, { limit: req.body.limit });
      const customerAccessToken = issueCustomerAccessToken(share.token);
      const cartPhotoIds = typeof repos.getShareCart === 'function' ? await repos.getShareCart(share.token) : [];
      res.json({
        ...(await publicPayload(share)),
        customerAccessToken,
        cartPhotoIds,
        photos: items.map((photo) => sharePhotoPayload(photo, customerAccessToken)),
        photosPage: page,
      });
    })
  );

  router.get(
    '/share-session/:token/photos',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token);
      if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para enviar um link atualizado.', 'share_not_found');
      if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado. Peça ao fotógrafo para recriar ou estender o acesso à galeria.', 'share_expired');
      validateCustomerAccess(req, share.token);
      const customerAccessToken = accessTokenFromRequest(req);
      const { items, page } = await repos.listPhotosForSharePage(share.token, {
        cursor: req.query.cursor,
        limit: req.query.limit,
      });
      res.json({
        photos: items.map((photo) => sharePhotoPayload(photo, customerAccessToken)),
        photosPage: page,
      });
    })
  );

  router.post(
    '/share-session/:token/cart',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token);
      if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para enviar um link atualizado.', 'share_not_found');
      if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado. Peça ao fotógrafo para recriar ou estender o acesso à galeria.', 'share_expired');
      validateCustomerAccess(req, share.token);
      const requestedPhotoIds = toPhotoIds(req.body.photoIds || req.body.photos);
      if (requestedPhotoIds.length) {
        const sharePhotos = await repos.listPhotosForShareByIds(share.token, requestedPhotoIds);
        if (sharePhotos.length !== requestedPhotoIds.length) {
          throw new HttpError(403, 'Uma ou mais fotos não pertencem a esta galeria. Atualize a página e selecione as fotos novamente.', 'photo_share_mismatch');
        }
      }
  const cartPhotoIds = typeof repos.saveShareCart === 'function'
    ? await repos.saveShareCart(share.token, requestedPhotoIds)
        : requestedPhotoIds;
      await recordConversion(repos, { type: 'cart_saved', shareToken: share.token, photoCount: cartPhotoIds.length });
      res.json({ cartPhotoIds, updatedAt: new Date().toISOString() });
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
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        count: order.count,
        phone: order.share.phone,
        clientName: order.share.clientName || '',
        clientEmail: order.share.clientEmail || '',
        packageType: order.share.packageType,
        photoIds: order.photoIds,
        shareToken: order.share.token,
      });
      await recordConversion(repos, {
        type: 'pix_generated',
        shareToken: order.share.token,
        sessionId,
        photoCount: order.count,
        amount: order.total,
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
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          photoCount: order.count,
          packageType: order.share.packageType,
          phone: order.share.phone,
          clientName: order.share.clientName || '',
          clientEmail: order.share.clientEmail || '',
          status: 'pending',
          paymentMethod: 'Dinheiro/Cartão',
          shareToken: order.share.token,
          deliveryStatus: 'idle',
        },
        order.photoIds
      );
      await recordConversion(repos, {
        type: 'manual_payment_requested',
        shareToken: order.share.token,
        sessionId,
        photoCount: order.count,
        amount: order.total,
      });
      res.json({
        sessionId: session.id,
        status: session.status,
        deliveryStatus: session.deliveryStatus,
        paymentMethod: session.paymentMethod,
      });
    })
  );

  return router;
}

module.exports = { createShareRouter };
