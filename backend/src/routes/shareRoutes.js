const express = require('express');
const fs = require('fs/promises');
const { HttpError, asyncHandler } = require('../errors');
const { applyManualDiscount } = require('../services/discounts');
const { deliveryContextForShareToken } = require('../services/deliveryContextService');
const { allowsGalleryDownload } = require('../services/deliveryModeService');
const { randomToken } = require('../tokens');
const { toPhotoIds } = require('./helpers');
const { sendStoredZip } = require('../services/zipService');
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

function downloadUrlForSharePhoto(shareToken, photoId, customerAccessToken) {
  const params = new URLSearchParams({ access_token: customerAccessToken });
  return `/api/share-session/${encodeURIComponent(shareToken)}/download/${encodeURIComponent(photoId)}?${params.toString()}`;
}

function downloadAllUrlForShare(shareToken, customerAccessToken) {
  const params = new URLSearchParams({ access_token: customerAccessToken });
  return `/api/share-session/${encodeURIComponent(shareToken)}/download-all?${params.toString()}`;
}

function downloadsPayload(share, customerAccessToken, purchasedPhotoIds = []) {
  const enabled = allowsGalleryDownload(share.deliveryMode);
  const purchasedCount = enabled ? purchasedPhotoIds.length : 0;
  return {
    enabled,
    purchasedCount,
    purchasedPhotoIds: enabled ? purchasedPhotoIds : [],
    downloadAllUrl: enabled && purchasedCount > 0 ? downloadAllUrlForShare(share.token, customerAccessToken) : '',
  };
}

function sharePhotoPayload(photo, customerAccessToken, options = {}) {
  const params = new URLSearchParams({ access_token: customerAccessToken });
  if (photo.mediaVersion) params.set('v', photo.mediaVersion);
  const purchased = Boolean(options.purchasedPhotoIds?.has(photo.id));
  const canDownload = purchased && allowsGalleryDownload(options.share?.deliveryMode);
  return {
    id: photo.id,
    url: `/api/media/${photo.id}/preview?${params.toString()}`,
    thumbUrl: `/api/media/${photo.id}/thumb?${params.toString()}`,
    mediaVersion: photo.mediaVersion || '',
    purchased,
    selectable: !purchased,
    downloadUrl: canDownload ? downloadUrlForSharePhoto(options.share.token, photo.id, customerAccessToken) : '',
  };
}

function safeFilePart(value, fallback = 'foto') {
  const normalized = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function downloadEntryName(photo, index = 0) {
  const base = safeFilePart(photo.id, `foto-${index + 1}`);
  return photo.deliveryVariant === 'story'
    ? `stories/${base}-stories.jpg`
    : `originais/${base}.jpg`;
}

async function sendSingleDownload(res, entry, fileName) {
  const data = await fs.readFile(entry.path);
  res.set({
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Type': 'image/jpeg',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(data);
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
  if (typeof repos.listDownloadEntitlementPhotoIds === 'function') {
    const purchased = new Set(await repos.listDownloadEntitlementPhotoIds(share.token));
    const alreadyPurchased = requestedPhotoIds.filter((photoId) => purchased.has(photoId));
    if (alreadyPurchased.length) {
      throw new HttpError(409, 'Uma ou mais fotos selecionadas já foram compradas nesta galeria. Atualize a página e escolha apenas fotos ainda disponíveis.', 'photo_already_purchased');
    }
  }

  const packageOptions = await packages.getSettings();
  const count = photoIds.length;
  const { subtotal } = calculateTotal(count, share.packageType, packageOptions);
  const totals = applyManualDiscount(subtotal, share.discountAmount);
  return { count, photoIds, share, ...totals };
}

function createShareRouter({ galleryOverlays, galleryWatermarks, media, packages, payment, repos, watermark }) {
  const router = express.Router();

  async function publicPayload(share, options = {}) {
    const payload = publicSharePayload(share);
    payload.deliveryMode = share.deliveryMode || 'whatsapp';
    payload.galleryDownloadEnabled = allowsGalleryDownload(share.deliveryMode);
    payload.downloads = downloadsPayload(share, options.customerAccessToken || '', options.purchasedPhotoIds || []);
    if (galleryWatermarks && typeof galleryWatermarks.effectiveForShare === 'function') {
      const effective = await galleryWatermarks.effectiveForShare(share);
      payload.watermarkSettings = galleryWatermarks.clientWatermarkPayload(effective, options.customerAccessToken || '');
    } else if (watermark && typeof watermark.getSettings === 'function') {
      payload.watermarkSettings = await watermark.getSettings();
    }
    if (galleryOverlays && typeof galleryOverlays.effectiveForShare === 'function') {
      const effectiveOverlay = await galleryOverlays.effectiveForShare(share);
      payload.overlaySettings = galleryOverlays.clientOverlayPayload(effectiveOverlay, options.customerAccessToken || '');
    } else {
      payload.overlaySettings = { enabled: false };
    }
    return payload;
  }

  async function purchasedPhotoIdsForShare(share) {
    if (typeof repos.listDownloadEntitlementPhotoIds !== 'function') return [];
    return repos.listDownloadEntitlementPhotoIds(share.token);
  }

  async function assertDownloadableShare(req) {
    const share = await repos.getShareSession(req.params.token);
    if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para enviar um link atualizado.', 'share_not_found');
    if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado. Peça ao fotógrafo para recriar ou estender o acesso à galeria.', 'share_expired');
    validateCustomerAccess(req, share.token);
    if (!allowsGalleryDownload(share.deliveryMode)) {
      throw new HttpError(403, 'Downloads não estão habilitados nesta galeria. Fale com o fotógrafo para liberar esta opção.', 'gallery_download_disabled');
    }
    return share;
  }

  async function prepareDownloadEntries(share, photos) {
    const deliveryContext = await deliveryContextForShareToken({ galleryOverlays, shareToken: share.token });
    const prepared = media.prepareDeliveryPhotos
      ? await media.prepareDeliveryPhotos(photos, deliveryContext.overlay, {
          storyDeliveryEnabled: deliveryContext.storyDeliveryEnabled,
        })
      : { photos, cleanup: async () => {} };
    const entries = prepared.photos.map((photo, index) => ({
      name: downloadEntryName(photo, index),
      path: media.absolutePath(photo.originalPath),
    }));
    return { cleanup: prepared.cleanup, entries };
  }

  router.get(
    '/share-session/:token',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token);
      if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para enviar um link atualizado.', 'share_not_found');
      await recordConversion(repos, { type: 'share_opened', shareToken: share.token, photoCount: share.photoCount });
      const customerAccessToken = accessTokenFromRequest(req);
      let validCustomerAccessToken = '';
      if (customerAccessToken) {
        try {
          validateCustomerAccess(req, share.token);
          validCustomerAccessToken = customerAccessToken;
        } catch {
          validCustomerAccessToken = '';
        }
      }
      const purchasedPhotoIds = validCustomerAccessToken ? await purchasedPhotoIdsForShare(share) : [];
      res.json(await publicPayload(share, { customerAccessToken: validCustomerAccessToken, purchasedPhotoIds }));
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
      const purchasedPhotoIds = await purchasedPhotoIdsForShare(share);
      const purchasedPhotoIdsSet = new Set(purchasedPhotoIds);
      const savedCartPhotoIds = typeof repos.getShareCart === 'function' ? await repos.getShareCart(share.token) : [];
      const cartPhotoIds = savedCartPhotoIds.filter((photoId) => !purchasedPhotoIdsSet.has(photoId));
      res.json({
        ...(await publicPayload(share, { customerAccessToken, purchasedPhotoIds })),
        customerAccessToken,
        cartPhotoIds,
        photos: items.map((photo) => sharePhotoPayload(photo, customerAccessToken, { purchasedPhotoIds: purchasedPhotoIdsSet, share })),
        photosPage: page,
      });
    })
  );

  router.get(
    '/share-session/:token/overlay/:assetId',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token);
      if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para enviar um link atualizado.', 'share_not_found');
      if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado. Peça ao fotógrafo para recriar ou estender o acesso à galeria.', 'share_expired');
      validateCustomerAccess(req, share.token);
      if (!share.overlayEnabled || share.overlayAssetId !== req.params.assetId) {
        throw new HttpError(404, 'Overlay não encontrado para esta galeria.', 'overlay_asset_not_found');
      }
      const asset = typeof repos.getOverlayAsset === 'function'
        ? await repos.getOverlayAsset(req.params.assetId)
        : null;
      if (!asset) throw new HttpError(404, 'Overlay não encontrado.', 'overlay_asset_not_found');
      await media.sendOverlayAsset(res, asset);
    })
  );

  router.get(
    '/share-session/:token/watermark/:assetId',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token);
      if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para enviar um link atualizado.', 'share_not_found');
      if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado. Peça ao fotógrafo para recriar ou estender o acesso à galeria.', 'share_expired');
      validateCustomerAccess(req, share.token);
      if (share.watermarkAssetId !== req.params.assetId) {
        throw new HttpError(404, "Marca d'água não encontrada para esta galeria.", 'watermark_asset_not_found');
      }
      const asset = typeof repos.getWatermarkAsset === 'function'
        ? await repos.getWatermarkAsset(req.params.assetId)
        : null;
      if (!asset) throw new HttpError(404, "Marca d'água não encontrada.", 'watermark_asset_not_found');
      await media.sendWatermarkAsset(res, asset);
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
      const purchasedPhotoIds = await purchasedPhotoIdsForShare(share);
      const purchasedPhotoIdsSet = new Set(purchasedPhotoIds);
      res.json({
        downloads: downloadsPayload(share, customerAccessToken, purchasedPhotoIds),
        photos: items.map((photo) => sharePhotoPayload(photo, customerAccessToken, { purchasedPhotoIds: purchasedPhotoIdsSet, share })),
        photosPage: page,
      });
    })
  );

  router.get(
    '/share-session/:token/download/:photoId',
    asyncHandler(async (req, res) => {
      const share = await assertDownloadableShare(req);
      const photo = typeof repos.getDownloadEntitledPhoto === 'function'
        ? await repos.getDownloadEntitledPhoto(share.token, req.params.photoId)
        : null;
      if (!photo) {
        throw new HttpError(404, 'Esta foto ainda não foi comprada nesta galeria ou não está mais disponível para download.', 'download_entitlement_not_found');
      }
      const prepared = await prepareDownloadEntries(share, [photo]);
      try {
        if (prepared.entries.length === 1) {
          await sendSingleDownload(res, prepared.entries[0], `${safeFilePart(photo.id)}.jpg`);
          return;
        }
        await sendStoredZip(res, prepared.entries, `${safeFilePart(photo.id)}.zip`);
      } finally {
        await prepared.cleanup();
      }
    })
  );

  router.get(
    '/share-session/:token/download-all',
    asyncHandler(async (req, res) => {
      const share = await assertDownloadableShare(req);
      const photos = typeof repos.listDownloadEntitledPhotos === 'function'
        ? await repos.listDownloadEntitledPhotos(share.token)
        : [];
      if (!photos.length) {
        throw new HttpError(404, 'Nenhuma foto comprada está disponível para download nesta galeria.', 'download_entitlement_not_found');
      }
      const prepared = await prepareDownloadEntries(share, photos);
      try {
        await sendStoredZip(res, prepared.entries, `${safeFilePart(share.galleryName || share.token, 'galeria')}.zip`);
      } finally {
        await prepared.cleanup();
      }
    })
  );

  router.post(
    '/share-session/:token/cart',
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token);
      if (!share) throw new HttpError(404, 'Link não encontrado. Peça ao fotógrafo para enviar um link atualizado.', 'share_not_found');
      if (isExpired(share)) throw new HttpError(410, 'Link expirado ou revogado. Peça ao fotógrafo para recriar ou estender o acesso à galeria.', 'share_expired');
      validateCustomerAccess(req, share.token);
      const purchasedPhotoIds = await purchasedPhotoIdsForShare(share);
      const purchasedPhotoIdsSet = new Set(purchasedPhotoIds);
      const requestedPhotoIds = toPhotoIds(req.body.photoIds || req.body.photos)
        .filter((photoId) => !purchasedPhotoIdsSet.has(photoId));
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
