const express = require('express');
const { HttpError, asyncHandler } = require('../errors');
const { addDays, generateAccessCode, hashValue, randomToken } = require('../tokens');
const { publicBaseUrlForRequest, toPhotoIds } = require('./helpers');

function normalizeAccessCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

async function resolvePublicBaseUrl(req, config, credentials) {
  const savedUrl = typeof credentials?.getSecretValue === 'function'
    ? await credentials.getSecretValue('publicBaseUrl')
    : '';
  return savedUrl || publicBaseUrlForRequest(req, config);
}

function createAdminRouter({ auth, config, credentials, deliveryQueue, media, packages, payment, repos, retention, upload, whatsappTemplates }) {
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
      const pix = await payment.createPixPayment({
        total: req.body.total,
        count: req.body.count,
        sessionId: req.body.sessionId,
        phone: req.body.phone,
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
      const isShareSession = Boolean(req.body.isShareSession || req.body.shareToken);
      const status = isShareSession ? 'pending' : 'approved';
      const session = await repos.createSession(
        {
          id: req.body.sessionId,
          amount: req.body.total,
          photoCount: req.body.count,
          packageType: req.body.packageType,
          phone: req.body.phone,
          status,
          paymentMethod: 'Dinheiro/Cartão',
          shareToken: req.body.shareToken || null,
          deliveryStatus: isShareSession ? 'idle' : 'queued',
        },
        photoIds
      );
      if (!isShareSession) await deliveryQueue.enqueue(session.id);
      res.json({ status: session.status, deliveryStatus: session.deliveryStatus, paymentMethod: session.paymentMethod });
    })
  );

  router.post(
    '/approve-manual-session/:id',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const session = await repos.approveSession(req.params.id);
      if (!session) throw new HttpError(404, 'Sessão não encontrada.', 'session_not_found');
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
      if (!req.body.phone || String(req.body.phone).replace(/\D/g, '').length < 10) {
        throw new HttpError(400, 'Informe o WhatsApp do cliente.', 'phone_required');
      }

      const safeMinutes = Math.min(180, Math.max(5, Number(req.body.expiresMinutes) || 30));
      const now = new Date();
      const token = randomToken(12);
      const accessCode = generateAccessCode(4);
      const expiresAt = new Date(now.getTime() + safeMinutes * 60 * 1000);
      const retentionExpiresAt = addDays(now, config.defaultGalleryRetentionDays);
      const link = new URL(`/s/${token}`, await resolvePublicBaseUrl(req, config, credentials)).toString();

      await repos.createShareSession({
        token,
        accessCodeHash: hashValue(accessCode),
        accessCode,
        phone: req.body.phone,
        packageType: req.body.packageType || 'eventos',
        photoCount: Number(req.body.count) || photoIds.length,
        total: Number(req.body.total) || 0,
        expiresAt,
        retentionExpiresAt,
        link,
        photoIds,
      });

      res.json({
        token,
        accessCode,
        expiresAt,
        link,
        whatsappMessage: await whatsappTemplates.renderShareLinkMessage({ link, accessCode, expiresMinutes: safeMinutes }),
      });
    })
  );

  router.post(
    '/share-sessions/:token/extend',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const updated = await repos.extendShareSession(req.params.token, Math.min(60, Math.max(1, Number(req.body.minutes) || 15)));
      if (!updated) throw new HttpError(404, 'Link não encontrado.', 'share_not_found');
      res.json(updated);
    })
  );

  router.post(
    '/share-sessions/:token/revoke',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const updated = await repos.revokeShareSession(req.params.token);
      if (!updated) throw new HttpError(404, 'Link não encontrado.', 'share_not_found');
      res.json(updated);
    })
  );

  router.post(
    '/share-sessions/:token/recreate',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const original = await repos.getShareSession(req.params.token, { includeSensitive: true });
      if (!original) throw new HttpError(404, 'Link não encontrado.', 'share_not_found');
      const photos = await repos.listPhotosForShare(original.token);
      if (!photos.length) throw new HttpError(400, 'Esta galeria não possui fotos para recriar.', 'share_photos_missing');

      const createdAt = new Date(original.createdAt).getTime();
      const expiresAt = new Date(original.expiresAt).getTime();
      const originalMinutes = Math.round((expiresAt - createdAt) / 60_000);
      const safeMinutes = Math.min(180, Math.max(5, Number.isFinite(originalMinutes) ? originalMinutes : 30));
      const now = new Date();
      const token = randomToken(12);
      const accessCode = original.accessCode || generateAccessCode(4);
      const newExpiresAt = new Date(now.getTime() + safeMinutes * 60 * 1000);
      const retentionExpiresAt = addDays(now, config.defaultGalleryRetentionDays);
      const link = new URL(`/s/${token}`, await resolvePublicBaseUrl(req, config, credentials)).toString();

      await repos.createShareSession({
        token,
        accessCodeHash: original.accessCodeHash || hashValue(accessCode),
        accessCode,
        phone: original.phone,
        packageType: original.packageType,
        photoCount: original.photoCount,
        total: original.total,
        expiresAt: newExpiresAt,
        retentionExpiresAt,
        link,
        photoIds: photos.map((photo) => photo.id),
      });

      res.json({
        token,
        accessCode,
        expiresAt: newExpiresAt,
        link,
        whatsappMessage: await whatsappTemplates.renderShareLinkMessage({ link, accessCode, expiresMinutes: safeMinutes }),
      });
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
        phone: body.phone ? String(body.phone) : undefined,
        packageType: body.packageType ? String(body.packageType) : undefined,
        total: body.total === undefined ? undefined : Number(body.total),
        expiresAt,
        accessCode,
        accessCodeHash: accessCode ? hashValue(accessCode) : undefined,
      });
      if (!updated) throw new HttpError(404, 'Link não encontrado.', 'share_not_found');
      res.json(updated);
    })
  );

  router.delete(
    '/share-sessions/:token',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const deleted = await repos.deleteShareSession(req.params.token);
      if (!deleted) throw new HttpError(404, 'Link não encontrado.', 'share_not_found');
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

  router.post('/cleanup/preview', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.preview());
  }));

  router.post('/cleanup/run', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.run());
  }));

  router.post('/delivery-jobs/:id/retry', auth.requireAdmin, asyncHandler(async (req, res) => {
    const job = await repos.retryDeliveryJob(req.params.id);
    if (!job) throw new HttpError(404, 'Entrega não encontrada.', 'delivery_job_not_found');
    res.json(job);
  }));

  router.get('/session/:sessionId', auth.requireAdmin, asyncHandler(async (req, res) => {
    const session = await repos.getSession(req.params.sessionId);
    if (!session) throw new HttpError(404, 'Sessão não encontrada.', 'session_not_found');
    res.json(session);
  }));

  return router;
}

module.exports = { createAdminRouter };
