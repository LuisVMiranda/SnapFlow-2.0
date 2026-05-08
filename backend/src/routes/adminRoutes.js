const express = require('express');
const { HttpError, asyncHandler } = require('../errors');
const { optionalEmail } = require('../services/email');
const { validateBrazilPhone } = require('../services/phone');
const { addDays, generateAccessCode, hashValue, randomToken } = require('../tokens');
const { publicBaseUrlForRequest, toPhotoIds } = require('./helpers');

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

async function resolvePublicBaseUrl(req, config, credentials) {
  const savedUrl = typeof credentials?.getSecretValue === 'function'
    ? await credentials.getSecretValue('publicBaseUrl')
    : '';
  return savedUrl || publicBaseUrlForRequest(req, config);
}

function adminPhotoPayload(photo) {
  return {
    id: photo.id,
    url: `/api/media/${photo.id}/preview`,
    thumbUrl: `/api/media/${photo.id}/thumb`,
    createdAt: photo.createdAt,
    sizeBytes: Number(photo.sizeBytes || 0),
  };
}

async function adminShareDetails(repos, token) {
  const share = await repos.getShareSession(token, { includeAccessCode: true });
  if (!share) return null;
  const photos = await repos.listPhotosForShare(share.token);
  return {
    ...share,
    photoCount: photos.length,
    photos: photos.map(adminPhotoPayload),
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
    return { whatsappSent: false, whatsappStatus: 'failed', whatsappError: error.message || 'Não foi possível enviar pelo WhatsApp agora. Verifique se o WhatsApp está pareado no painel e tente reenviar.' };
  }
}

function createAdminRouter({ auth, config, credentials, deliveryQueue, media, packages, payment, repos, retention, upload, whatsapp, whatsappTemplates }) {
  const router = express.Router();

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
      res.json(await repos.dashboard());
    })
  );

  router.post(
    '/pix',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const photoIds = toPhotoIds(req.body.photoIds || req.body.photos);
      const phone = validateBrazilPhone(req.body.phone);
      if (!phone.valid) throw new HttpError(400, phone.message, phone.code);
      const pix = await payment.createPixPayment({
        total: req.body.total,
        count: req.body.count,
        sessionId: req.body.sessionId,
        phone: phone.normalized,
        clientName: normalizeClientName(req.body.clientName),
        clientEmail: normalizeClientEmail(req.body.clientEmail),
        packageType: req.body.packageType,
        photoIds,
      });
      res.json(pix);
    })
  );

  router.post(
    '/manual-payment',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const photoIds = toPhotoIds(req.body.photoIds || req.body.photos);
      const phone = validateBrazilPhone(req.body.phone);
      if (!phone.valid) throw new HttpError(400, phone.message, phone.code);
      const session = await repos.createSession(
        {
          id: req.body.sessionId,
          amount: req.body.total,
          photoCount: req.body.count,
          packageType: req.body.packageType,
          phone: phone.normalized,
          clientName: normalizeClientName(req.body.clientName),
          clientEmail: normalizeClientEmail(req.body.clientEmail),
          status: 'pending',
          paymentMethod: 'Dinheiro/Cartão',
          shareToken: req.body.shareToken || null,
          deliveryStatus: 'idle',
        },
        photoIds
      );
      res.json({
        sessionId: session.id,
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
      const session = await repos.approveSession(req.params.id);
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
      const phone = validateBrazilPhone(req.body.phone);
      if (!phone.valid) throw new HttpError(400, phone.message, phone.code);
      const clientName = normalizeClientName(req.body.clientName);
      const clientEmail = normalizeClientEmail(req.body.clientEmail);
      const galleryName = normalizeGalleryName(req.body.galleryName);
      const galleryDescription = normalizeGalleryDescription(req.body.galleryDescription);

      const safeMinutes = Math.min(180, Math.max(5, Number(req.body.expiresMinutes) || 30));
      const now = new Date();
      const token = randomToken(12);
      const accessCode = generateAccessCode(4);
      const expiresAt = new Date(now.getTime() + safeMinutes * 60 * 1000);
      const retentionExpiresAt = addDays(now, config.defaultGalleryRetentionDays);
      const link = new URL(`/s/${token}`, await resolvePublicBaseUrl(req, config, credentials)).toString();

      const share = await repos.createShareSession({
        token,
        accessCodeHash: hashValue(accessCode),
        accessCode,
        phone: phone.normalized,
        clientName,
        clientEmail,
        galleryName,
        galleryDescription,
        packageType: req.body.packageType || 'eventos',
        photoCount: Number(req.body.count) || photoIds.length,
        total: Number(req.body.total) || 0,
        expiresAt,
        retentionExpiresAt,
        link,
        photoIds,
      });

      const whatsappMessage = await whatsappTemplates.renderShareLinkMessage({ link, accessCode, expiresMinutes: safeMinutes, name: clientName, clientName });
      const whatsappResult = await sendShareLinkMessage({ whatsapp, phone: phone.normalized, message: whatsappMessage });

      res.json({
        token,
        accessCode,
        expiresAt,
        link,
        whatsappMessage,
        clientName,
        clientEmail,
        galleryName: share.galleryName,
        galleryDescription: share.galleryDescription,
        sales: share.sales,
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
      const safeMinutes = Math.min(180, Math.max(5, Number.isFinite(originalMinutes) ? originalMinutes : 30));
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
      const details = await adminShareDetails(repos, req.params.token);
      if (!details) throw new HttpError(404, 'Link não encontrado. Atualize Galerias e confirme se ele ainda existe.', 'share_not_found');
      res.json(details);
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
      const processed = await media.processUploadedFiles(req.files || [], retentionExpiresAt);
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
      res.json({ success: true, photoId: deleted?.id || req.params.photoId });
    })
  );

  router.patch(
    '/share-sessions/:token',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      let accessCode = null;
      if (body.accessCode !== undefined && String(body.accessCode).trim() !== '') {
        accessCode = normalizeAccessCode(body.accessCode);
        if (accessCode.length !== 4) {
          throw new HttpError(400, 'Informe um código de acesso com 4 caracteres.', 'invalid_access_code');
        }
      }

      const minutes = Number(body.expiresMinutes);
      const expiresAt = Number.isFinite(minutes) && minutes > 0
        ? new Date(Date.now() + Math.min(180, Math.max(5, minutes)) * 60 * 1000)
        : null;

      const updated = await repos.updateShareSession(req.params.token, {
        clientName: body.clientName === undefined ? undefined : normalizeClientName(body.clientName),
        clientEmail: body.clientEmail === undefined ? undefined : normalizeClientEmail(body.clientEmail),
        galleryName: body.galleryName === undefined ? undefined : normalizeGalleryName(body.galleryName),
        galleryDescription: body.galleryDescription === undefined ? undefined : normalizeGalleryDescription(body.galleryDescription),
        phone: body.phone ? String(body.phone) : undefined,
        packageType: body.packageType ? String(body.packageType) : undefined,
        total: body.total === undefined ? undefined : Number(body.total),
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

  router.get('/settings/whatsapp-messages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await whatsappTemplates.getSettings());
  }));

  router.put('/settings/whatsapp-messages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await whatsappTemplates.updateSettings(req.body || {}));
  }));

  router.get('/whatsapp/status', auth.requireAdmin, (req, res) => {
    res.json(whatsapp?.getStatus ? whatsapp.getStatus() : { ready: false, status: 'unavailable', lastError: 'Cliente WhatsApp indisponível. Reinicie o backend e abra Vendas para parear novamente.' });
  });

  router.post('/whatsapp/reconnect', auth.requireAdmin, asyncHandler(async (req, res) => {
    if (!whatsapp?.reconnect) throw new HttpError(503, 'Cliente WhatsApp indisponível. Reinicie o backend e abra Vendas para parear novamente.', 'whatsapp_unavailable');
    whatsapp.reconnect().catch((error) => {
      console.warn(`Reconexão manual do WhatsApp falhou: ${error.message}`);
    });
    res.status(202).json(whatsapp.getStatus());
  }));

  router.post('/whatsapp/reset-auth', auth.requireAdmin, asyncHandler(async (req, res) => {
    if (!whatsapp?.resetAuth) throw new HttpError(503, 'Cliente WhatsApp indisponível. Reinicie o backend e abra Vendas para parear novamente.', 'whatsapp_unavailable');
    res.status(202).json(await whatsapp.resetAuth());
  }));

  router.post('/cleanup/preview', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.preview());
  }));

  router.post('/cleanup/run', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.run());
  }));

  router.post('/delivery-jobs/:id/retry', auth.requireAdmin, asyncHandler(async (req, res) => {
    const job = await repos.retryDeliveryJob(req.params.id);
    if (!job) throw new HttpError(404, 'Entrega não encontrada. Atualize Vendas e confirme se esta venda ainda aparece no painel.', 'delivery_job_not_found');
    res.json(job);
  }));

  router.post('/sessions/:sessionId/retry-delivery', auth.requireAdmin, asyncHandler(async (req, res) => {
    const session = await repos.getSession(req.params.sessionId);
    if (!session) throw new HttpError(404, 'Sessão não encontrada. Atualize o painel e confirme se a venda ainda existe.', 'session_not_found');
    if (session.status !== 'approved') {
      throw new HttpError(409, 'A sessão ainda não foi aprovada para envio. Libere o pagamento no painel antes de reenviar as fotos.', 'session_not_approved');
    }
    const job = await repos.retryDeliveryForSession(session.id);
    await repos.updateDeliveryStatus(session.id, 'queued', null);
    if (typeof deliveryQueue.processOnce === 'function') await deliveryQueue.processOnce();
    res.json({ success: true, job, session: await repos.getSession(session.id) });
  }));

  router.post('/stats/clear', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await repos.clearSalesStats());
  }));

  router.get('/session/:sessionId', auth.requireAdmin, asyncHandler(async (req, res) => {
    const session = await repos.getSession(req.params.sessionId);
    if (!session) throw new HttpError(404, 'Sessão não encontrada. Atualize o painel e confirme se a venda ainda existe.', 'session_not_found');
    res.json(session);
  }));

  return router;
}

module.exports = { createAdminRouter };
