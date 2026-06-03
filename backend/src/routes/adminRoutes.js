const express = require('express');
const { HttpError, asyncHandler } = require('../errors');
const { applyManualDiscount, normalizeDiscountAmount, normalizeSubtotal } = require('../services/discounts');
const { optionalEmail } = require('../services/email');
const { validateClientPhone } = require('../services/phone');
const { addDays, generateAccessCode, hashValue } = require('../tokens');
const { adminPhotoPagePayload, adminPhotoPayload, adminShareDetails } = require('./adminSharePayloads');
const { createOrRestoreShareSession, resolvePublicBaseUrl } = require('./adminShareSessionCreation');
const { assignInitialOverlay, createSaleGallery } = require('./adminSaleGallery');
const { toPhotoIds } = require('./helpers');
const { normalizeShareExpiresMinutes } = require('../services/shareExpiration');

function normalizeAccessCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

function normalizeClientName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function normalizeClientEmail(value) {
  const normalized = optionalEmail(value);
  if (normalized) return normalized;
  if (String(value || '').trim()) {
    throw new HttpError(400, 'Informe um e-mail válido para o cliente ou deixe o campo em branco. O Pix funciona sem e-mail, mas o Mercado Pago exige um formato válido quando esse campo é preenchido.', 'invalid_client_email');
  }
  return '';
}

function normalizeGalleryName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function normalizeGalleryDescription(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 800);
}

async function resolveSaleAmounts(body = {}) {
  const subtotal = normalizeSubtotal(body.subtotal ?? body.total);
  const configuredDiscountAmount = normalizeDiscountAmount(body.discountAmount, subtotal);
  return {
    ...applyManualDiscount(subtotal, configuredDiscountAmount),
    configuredDiscountAmount,
  };
}

async function sendShareLinkMessage({ whatsapp, phone, message }) {
  if (!whatsapp || typeof whatsapp.sendText !== 'function') {
    return { whatsappSent: false, whatsappStatus: 'unavailable', whatsappError: 'WhatsApp indisponível. Abra Vendas, confira o cartão WhatsApp de envio e tente reconectar.' };
  }
  try {
    await whatsapp.sendText(phone, message);
    return { whatsappSent: true, whatsappStatus: 'sent' };
  } catch (error) {
    return { whatsappSent: false, whatsappStatus: 'failed', whatsappError: whatsappSendErrorMessage(error) };
  }
}

function whatsappSendErrorMessage(error) {
  const message = String(error.message || '').trim();
  const whatsappLostContext = [
    'Attempted to use detached Frame',
    'Execution context was destroyed',
    'Protocol error',
    'Target closed',
    'Session closed',
  ].some((needle) => message.includes(needle));
  if (whatsappLostContext) {
    return 'O WhatsApp Web perdeu a conexão controlada pelo SnapFlow enquanto a mensagem era enviada. O link foi criado; abra Vendas > WhatsApp de envio, confira se aparece QR Code ou status Pronto e tente enviar novamente.';
  }
  return message || 'Não foi possível enviar pelo WhatsApp agora. Verifique se o WhatsApp está pareado no painel e tente reenviar.';
}

function createAdminRouter({ auth, config, credentials, deliveryQueue, galleryOverlays, galleryPresets, galleryWatermarks, media, packages, payment, repos, retention, storyDelivery, upload, whatsapp, whatsappTemplates, watermark }) {
  const router = express.Router();

  async function assertStoryReady(body = {}, share = null) {
    if (body.storyDeliveryEnabled !== true || !storyDelivery?.assertReady) return;
    const overlayAssetId = body.overlayAssetId || body.assetId || '';
    const overlayEnabled = body.overlayEnabled === undefined && !share && overlayAssetId ? true : body.overlayEnabled;
    await storyDelivery.assertReady({ enabled: true, overlayAssetId, overlayEnabled, share });
  }

  router.get('/access', auth.requireAdmin, (req, res) => {
    res.json({ ok: true });
  });

  router.post(
    '/upload',
    auth.requireAdmin,
    upload.photos,
    asyncHandler(async (req, res) => {
      const retentionExpiresAt = addDays(new Date(), config.defaultGalleryRetentionDays);
      const processed = await media.processUploadedFiles(req.files || [], retentionExpiresAt);
      const photos = await repos.createPhotos(processed);
      res.json({
        photos: photos.map((photo) => ({
          id: photo.id,
          url: `/api/media/${photo.id}/preview`,
          thumbUrl: `/api/media/${photo.id}/thumb`,
        })),
        urls: photos.map((photo) => `/api/media/${photo.id}/preview`),
        thumbUrls: photos.map((photo) => `/api/media/${photo.id}/thumb`),
      });
    })
  );

  router.get(
    '/dashboard',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      if (typeof repos.ensureDirectSaleGalleries === 'function') {
        await repos.ensureDirectSaleGalleries({
          defaultGalleryRetentionDays: config.defaultGalleryRetentionDays,
          publicBaseUrl: await resolvePublicBaseUrl(req, config, credentials),
        });
      }
      res.json(await repos.dashboard());
    })
  );

  router.post(
    '/pix',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const photoIds = toPhotoIds(req.body.photoIds || req.body.photos);
      const phone = validateClientPhone(req.body.phone);
      if (!phone.valid) throw new HttpError(400, phone.message, phone.code);
      const clientName = normalizeClientName(req.body.clientName);
      const clientEmail = normalizeClientEmail(req.body.clientEmail);
      const totals = await resolveSaleAmounts(req.body, packages);
      await assertStoryReady(req.body);
      let shareToken = String(req.body.shareToken || '').trim();
      if (!shareToken && photoIds.length) {
        const saleGallery = await createSaleGallery(
          { config, credentials, repos },
          { clientEmail, clientName, phone, photoIds, req, totals }
        );
        shareToken = saleGallery.share?.token || '';
      }
      await assignInitialOverlay({ galleryOverlays, shareToken, body: req.body });
      const pix = await payment.createPixPayment({
        ...totals,
        count: req.body.count,
        sessionId: req.body.sessionId,
        phone: phone.stored,
        clientName,
        clientEmail,
        packageType: req.body.packageType,
        photoIds,
        shareToken: shareToken || null,
      });
      if (typeof repos.recordConversionEvent === 'function') {
        await repos.recordConversionEvent({
          type: 'pix_generated',
          shareToken: shareToken || null,
          sessionId: req.body.sessionId,
          photoCount: req.body.count,
          amount: req.body.total,
        }).catch((error) => console.warn(`Falha ao registrar conversao de Pix admin: ${error.message}`));
      }
      res.json({ ...pix, shareToken: shareToken || null });
    })
  );

  router.post(
    '/manual-payment',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const photoIds = toPhotoIds(req.body.photoIds || req.body.photos);
      const phone = validateClientPhone(req.body.phone);
      if (!phone.valid) throw new HttpError(400, phone.message, phone.code);
      const clientName = normalizeClientName(req.body.clientName);
      const clientEmail = normalizeClientEmail(req.body.clientEmail);
      const totals = await resolveSaleAmounts(req.body, packages);
      await assertStoryReady(req.body);
      let shareToken = String(req.body.shareToken || '').trim();
      if (!shareToken && photoIds.length) {
        const saleGallery = await createSaleGallery(
          { config, credentials, repos },
          { clientEmail, clientName, phone, photoIds, req, totals }
        );
        shareToken = saleGallery.share?.token || '';
      }
      await assignInitialOverlay({ galleryOverlays, shareToken, body: req.body });
      const session = await repos.createSession(
        {
          id: req.body.sessionId,
          ...totals,
          amount: totals.total,
          photoCount: req.body.count,
          packageType: req.body.packageType,
          phone: phone.stored,
          clientName,
          clientEmail,
          status: 'pending',
          paymentMethod: 'Dinheiro/Cartão',
          shareToken: shareToken || null,
          deliveryStatus: 'idle',
        },
        photoIds
      );
      if (typeof repos.recordConversionEvent === 'function') {
        await repos.recordConversionEvent({
          type: 'manual_payment_requested',
          shareToken: shareToken || null,
          sessionId: session.id,
          photoCount: session.photoCount,
          amount: session.amount,
        }).catch((error) => console.warn(`Falha ao registrar conversao manual admin: ${error.message}`));
      }
      res.json({
        sessionId: session.id,
        shareToken: session.shareToken,
        status: session.status,
        deliveryStatus: session.deliveryStatus,
        paymentMethod: session.paymentMethod,
      });
    })
  );

  router.post(
    '/approve-manual-session/:id',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const current = await repos.getSession(req.params.id);
      if (!current) throw new HttpError(404, 'Sessão não encontrada. Atualize o painel e confirme se a venda ainda existe.', 'session_not_found');
      if (current.status === 'approved') {
        res.json({ success: true, alreadyApproved: true, session: current });
        return;
      }
      if (current.status === 'cancelled') {
        throw new HttpError(409, 'A liberação desta venda foi cancelada. Gere uma nova solicitação se o cliente ainda quiser comprar.', 'session_release_cancelled');
      }
      const session = await repos.approveSession(req.params.id);
      if (!session) throw new HttpError(409, 'Não foi possível liberar esta venda. Atualize o painel e confira o status atual.', 'session_not_approvable');
      if (typeof repos.recordConversionEvent === 'function') {
        await repos.recordConversionEvent({
          type: 'payment_approved',
          shareToken: session.shareToken,
          sessionId: session.id,
          photoCount: session.photoCount,
          amount: session.amount,
        }).catch((error) => console.warn(`Falha ao registrar conversao de pagamento manual: ${error.message}`));
      }
      await deliveryQueue.enqueue(session.id);
      res.json({ success: true, session });
    })
  );

  router.post(
    '/share-session',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const photoIds = toPhotoIds(req.body.photoIds || req.body.photos);
      if (!photoIds.length) throw new HttpError(400, 'Selecione ao menos uma foto para compartilhar.', 'photos_required');
      const phone = validateClientPhone(req.body.phone);
      if (!phone.valid) throw new HttpError(400, phone.message, phone.code);
      const clientName = normalizeClientName(req.body.clientName);
      const clientEmail = normalizeClientEmail(req.body.clientEmail);
      const galleryName = normalizeGalleryName(req.body.galleryName);
      const galleryDescription = normalizeGalleryDescription(req.body.galleryDescription);

      const safeMinutes = normalizeShareExpiresMinutes(req.body.expiresMinutes);
      const now = new Date();
      const accessCode = generateAccessCode(4);
      const expiresAt = new Date(now.getTime() + safeMinutes * 60 * 1000);
      const retentionExpiresAt = addDays(now, config.defaultGalleryRetentionDays);
      const totals = await resolveSaleAmounts(req.body, packages);
      await assertStoryReady(req.body);
      const { accessCode: resolvedAccessCode, link, share } = await createOrRestoreShareSession({
        accessCode,
        baseUrl: await resolvePublicBaseUrl(req, config, credentials),
        expiresAt,
        galleryDescription,
        galleryName,
        phone,
        photoIds,
        repos,
        requestBody: {
          ...req.body,
          clientName,
          clientEmail,
          subtotal: totals.subtotal,
          discountAmount: totals.configuredDiscountAmount,
          total: totals.total,
          storyDeliveryEnabled: req.body.storyDeliveryEnabled === true,
        },
        retentionExpiresAt,
      });
      const requestedPresetIds = Array.isArray(req.body.photoPresetIds) ? req.body.photoPresetIds : [];
      const presetResult = requestedPresetIds.length && galleryPresets.applyGalleryPresets
        ? await galleryPresets.applyGalleryPresets(share.token, requestedPresetIds, { confirmReplace: true })
        : null;
      const finalShare = presetResult?.share || share;
      const overlayAssetId = String(req.body.overlayAssetId || '').trim();
      const overlayResult = overlayAssetId && galleryOverlays?.assignToShare
        ? await galleryOverlays.assignToShare(finalShare.token, { assetId: overlayAssetId, enabled: true, settings: req.body.overlaySettings })
        : null;
      const responseShare = overlayResult?.share || finalShare;

      const whatsappMessage = await whatsappTemplates.renderShareLinkMessage({ link, accessCode: resolvedAccessCode, expiresMinutes: safeMinutes, name: clientName, clientName });
      const whatsappResult = await sendShareLinkMessage({ whatsapp, phone: phone.stored, message: whatsappMessage });

      res.json({
        token: responseShare.token,
        galleryId: responseShare.galleryId,
        accessCode: resolvedAccessCode,
        expiresAt,
        link,
        whatsappMessage,
        clientName,
        clientEmail,
        galleryName: responseShare.galleryName,
        galleryDescription: responseShare.galleryDescription,
        overlayAssetId: responseShare.overlayAssetId || '',
        overlayEnabled: Boolean(responseShare.overlayEnabled),
        storyDeliveryEnabled: Boolean(responseShare.storyDeliveryEnabled),
        photoPresetIds: responseShare.photoPresetIds || [],
        photoPresetSnapshot: responseShare.photoPresetSnapshot || [],
        subtotal: responseShare.subtotal,
        discountAmount: responseShare.discountAmount,
        total: responseShare.total,
        sales: responseShare.sales,
        ...whatsappResult,
      });
    })
  );

  router.post(
    '/share-sessions/:token/extend',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const updated = await repos.extendShareSession(req.params.token, Math.min(60, Math.max(1, Number(req.body.minutes) || 15)));
      if (!updated) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      res.json(updated);
    })
  );

  router.post(
    '/share-sessions/:token/revoke',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const updated = await repos.revokeShareSession(req.params.token);
      if (!updated) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      res.json(updated);
    })
  );

  router.post(
    '/share-sessions/:token/recreate',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      let original = await repos.getShareSession(req.params.token, { includeSensitive: true });
      if (!original) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      let photos = await repos.listPhotosForShare(original.token);
      if (!photos.length && typeof repos.findShareWithMatchingMetadata === 'function') {
        const matched = await repos.findShareWithMatchingMetadata(original);
        if (matched) {
          await repos.deleteShareSession(original.token);
          original = matched;
          photos = await repos.listPhotosForShare(original.token);
        }
      }
      if (!photos.length) throw new HttpError(400, 'Esta galeria não possui fotos para recriar. Abra Ver/Editar e adicione fotos antes de recriar o link.', 'share_photos_missing');
      const createdAt = new Date(original.createdAt).getTime();
      const expiresAt = new Date(original.expiresAt).getTime();
      const originalMinutes = Math.round((expiresAt - createdAt) / 60_000);
      const safeMinutes = normalizeShareExpiresMinutes(Number.isFinite(originalMinutes) ? originalMinutes : undefined);
      const now = new Date();
      const accessCode = original.accessCode || generateAccessCode(4);
      const newExpiresAt = new Date(now.getTime() + safeMinutes * 60 * 1000);
      const retentionExpiresAt = addDays(now, config.defaultGalleryRetentionDays);
      const link = original.link || new URL(`/s/${original.token}`, await resolvePublicBaseUrl(req, config, credentials)).toString();

      const updated = await repos.reactivateShareSession(original.token, {
        accessCodeHash: original.accessCodeHash || hashValue(accessCode),
        accessCode,
        expiresAt: newExpiresAt,
        retentionExpiresAt,
        link,
      });
      if (typeof repos.deleteDetachedShareDuplicates === 'function') {
        await repos.deleteDetachedShareDuplicates(updated);
      }

      res.json({
        token: updated.token,
        galleryId: updated.galleryId,
        accessCode,
        expiresAt: newExpiresAt,
        link,
        whatsappMessage: await whatsappTemplates.renderShareLinkMessage({
          link,
          accessCode,
          expiresMinutes: safeMinutes,
          name: original.clientName || '',
          clientName: original.clientName || '',
        }),
      });
    })
  );

  router.get(
    '/share-sessions/:token',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const details = await adminShareDetails(repos, req.params.token, {
        cursor: req.query.cursor,
        limit: req.query.limit,
      });
      if (!details) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      res.json(details);
    })
  );

  router.get(
    '/share-sessions/:token/photos',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token, { includeAccessCode: true });
      if (!share) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      const { items, page } = await repos.listPhotosForSharePage(share.token, {
        cursor: req.query.cursor,
        limit: req.query.limit,
      });
      res.json({
        photos: items.map(adminPhotoPayload),
        photosPage: adminPhotoPagePayload(page),
      });
    })
  );

  router.post(
    '/share-sessions/:token/photos',
    auth.requireAdmin,
    upload.photos,
    asyncHandler(async (req, res) => {
      const share = await repos.getShareSession(req.params.token, { includeAccessCode: true });
      if (!share) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      const retentionExpiresAt = share.retentionExpiresAt || addDays(new Date(), config.defaultGalleryRetentionDays);
      const effectiveWatermark = galleryWatermarks && typeof galleryWatermarks.effectiveForShare === 'function'
        ? await galleryWatermarks.effectiveForShare(share)
        : null;
      const effectiveOverlay = galleryOverlays && typeof galleryOverlays.effectiveForShare === 'function'
        ? await galleryOverlays.effectiveForShare(share)
        : null;
      const processed = await media.processUploadedFiles(req.files || [], retentionExpiresAt, {
        overlay: effectiveOverlay,
        presetStack: share.photoPresetSnapshot || [],
        watermark: effectiveWatermark,
      });
      await repos.createPhotos(processed.map((photo) => ({ ...photo, shareToken: share.token })));
      await repos.refreshSharePhotoCount(share.token);
      res.json(await adminShareDetails(repos, share.token));
    })
  );

  router.delete(
    '/share-sessions/:token/photos/:photoId',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const photo = await repos.getPhoto(req.params.photoId);
      if (!photo || photo.shareToken !== req.params.token) {
        throw new HttpError(404, 'Foto não encontrada nesta galeria. Atualize Ver/Editar e tente novamente.', 'photo_not_found');
      }
      const removal = await media.removeOrArchive(photo, false);
      if (removal.errors.length) {
        throw new HttpError(500, 'Não foi possível remover todos os arquivos da foto.', 'photo_delete_failed', { errors: removal.errors });
      }
      const deleted = await repos.deletePhotoFromShare(req.params.token, req.params.photoId);
      await repos.refreshSharePhotoCount(req.params.token);
      res.json({ success: true, photoId: deleted.id || req.params.photoId });
    })
  );

  router.patch(
    '/share-sessions/:token',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const currentShare = await repos.getShareSession(req.params.token, { includeAccessCode: true });
      if (!currentShare) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      await assertStoryReady(body, currentShare);
      const saleAmounts = (body.total !== undefined || body.subtotal !== undefined || body.discountAmount !== undefined)
        ? await resolveSaleAmounts({
            subtotal: body.subtotal ?? body.total,
            discountAmount: body.discountAmount,
            count: body.count ?? body.photoCount ?? currentShare.photoCount ?? 0,
            packageType: body.packageType ?? currentShare.packageType,
          }, packages)
        : null;
      let accessCode = null;
      if (body.accessCode !== undefined && String(body.accessCode).trim() !== '') {
        accessCode = normalizeAccessCode(body.accessCode);
        if (accessCode.length !== 4) {
          throw new HttpError(400, 'Informe um código de acesso com 4 caracteres.', 'invalid_access_code');
        }
      }

      const minutes = Number(body.expiresMinutes);
      const expiresAt = Number.isFinite(minutes) && minutes > 0
        ? new Date(Date.now() + normalizeShareExpiresMinutes(minutes) * 60 * 1000)
        : null;

      const validatedPhone = body.phone === undefined ? null : validateClientPhone(body.phone);
      if (validatedPhone && !validatedPhone.valid) {
        throw new HttpError(400, validatedPhone.message, validatedPhone.code);
      }

      const updated = await repos.updateShareSession(req.params.token, {
        clientName: body.clientName === undefined ? undefined : normalizeClientName(body.clientName),
        clientEmail: body.clientEmail === undefined ? undefined : normalizeClientEmail(body.clientEmail),
        galleryName: body.galleryName === undefined ? undefined : normalizeGalleryName(body.galleryName),
        galleryDescription: body.galleryDescription === undefined ? undefined : normalizeGalleryDescription(body.galleryDescription),
        storyDeliveryEnabled: body.storyDeliveryEnabled === undefined ? undefined : body.storyDeliveryEnabled === true,
        phone: body.phone === undefined ? undefined : validatedPhone.stored,
        packageType: body.packageType ? String(body.packageType) : undefined,
        ...(saleAmounts
          ? {
              subtotal: saleAmounts.subtotal,
              discountAmount: saleAmounts.configuredDiscountAmount,
              total: saleAmounts.total,
            }
          : {}),
        expiresAt,
        accessCode,
        accessCodeHash: accessCode ? hashValue(accessCode) : undefined,
      });
      if (!updated) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      res.json(updated);
    })
  );

  router.delete(
    '/share-sessions/:token',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const deleted = await repos.deleteShareSession(req.params.token);
      if (!deleted) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      res.json({ success: true, token: deleted.token, deletedAt: deleted.deletedAt });
    })
  );

  router.get('/settings/retention', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.getSettings());
  }));

  router.put('/settings/retention', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.updateSettings(req.body || {}));
  }));

  router.get('/settings/packages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await packages.getSettings());
  }));

  router.put('/settings/packages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await packages.updateSettings(req.body || {}));
  }));

  router.get('/settings/watermark', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await watermark.getSettings());
  }));

  router.put('/settings/watermark', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await watermark.updateSettings(req.body || {}));
  }));

  router.get('/settings/whatsapp-messages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await whatsappTemplates.getSettings());
  }));

  router.put('/settings/whatsapp-messages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await whatsappTemplates.updateSettings(req.body || {}));
  }));

  return router;
}

module.exports = { createAdminRouter };
