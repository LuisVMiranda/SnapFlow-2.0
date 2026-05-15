const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const request = require('supertest');
const { createApp } = require('../src/app');
const { lockMsFromConfig } = require('../src/auth');
const { buildPhotoPage, decodePhotoCursor, normalizePhotoPageLimit } = require('../src/services/photoPagination');
const { hashValue } = require('../src/tokens');

function createTestApp({
  deliveryQueue = { enqueue: async () => null },
  initialDeletedShareToken = null,
  initialPhotos = null,
  whatsapp = {
    getStatus: () => ({ ready: true, status: 'ready', lastError: null }),
    reconnect: async () => ({ ready: true, status: 'ready', lastError: null }),
    resetAuth: async () => ({ ready: false, status: 'initializing', lastError: null }),
    sendText: async () => {},
  },
} = {}) {
  const emptySales = () => ({
    soldPhotoCount: 0,
    soldOrderCount: 0,
    soldAmount: 0,
    lastSoldAt: null,
  });
  const basePhotos = initialPhotos || [{ id: 'photo_1', shareToken: 'share_1', sizeBytes: 100, createdAt: new Date(Date.now() - 1000).toISOString() }];
  let share = {
    token: 'share_1',
    galleryId: 'gallery_1',
    galleryName: 'Galeria Família',
    galleryDescription: 'Seleção final do aniversário',
    accessCodeHash: hashValue('1234'),
    accessCode: '1234',
    packageType: 'eventos',
    phone: '11999999999',
    clientName: 'Ana Cliente',
    clientEmail: '',
    photoCount: basePhotos.filter((photo) => photo.shareToken === 'share_1' && !photo.deletedAt).length,
    subtotal: 10,
    discountAmount: 0,
    total: 10,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    revokedAt: null,
    status: 'active',
    link: 'http://localhost:5173/s/share_1',
    sales: emptySales(),
  };
  let deletedShareToken = initialDeletedShareToken;
  if (deletedShareToken === share.token) {
    share = { ...share, deletedAt: new Date().toISOString(), status: 'revoked' };
  }
  let recreatedShare = null;
  const sessions = new Map();
  let photos = basePhotos;
  let whatsappTemplateSettings = {
    shareLink: {
      label: 'Link da galeria',
      description: 'Mensagem de link',
      body: 'Abra {linkLabel}: {link}\nCódigo {code}',
    },
    paymentWaiting: {
      label: 'Aguardando pagamento',
      description: 'Mensagem de pagamento',
      body: 'Aguardando pagamento. {linkText}',
    },
    deliveryThanks: {
      label: 'Agradecimento e envio',
      description: 'Mensagem de entrega',
      body: 'Obrigado pela compra!',
    },
  };
  const repos = {
    dashboard: async () => ({
      stats: {
        hoje: { valor: 0, fotos: 0, sessoes: 0 },
        semana: { valor: 0, fotos: 0, sessoes: 0 },
        mes: { valor: 0, fotos: 0, sessoes: 0 },
        ano: { valor: 0, fotos: 0, sessoes: 0 },
      },
      chartSeries: {
        diario: [],
        semanal: [],
        mensal: [],
        anual: [],
      },
      recent: Array.from(sessions.values()).filter((session) => {
        const hasSharePhotos = photos.some((photo) => photo.sessionId === session.id && photo.shareToken);
        const hasActiveSharePhotos = photos.some((photo) => photo.sessionId === session.id && photo.shareToken && deletedShareToken !== photo.shareToken);
        return (!session.shareToken && !hasSharePhotos)
          || (session.shareToken && deletedShareToken !== session.shareToken)
          || hasActiveSharePhotos;
      }),
      shareRecent: deletedShareToken ? [] : [{
        token: 'share_1',
        photoCount: 1,
        status: 'active',
        accessCode: share.accessCode,
        clientName: share.clientName,
        galleryName: share.galleryName,
        galleryDescription: share.galleryDescription,
        subtotal: share.subtotal,
        discountAmount: share.discountAmount,
        total: share.total,
        sales: share.sales,
      }],
    }),
    getShareSession: async (token, options = {}) => {
      const normalizedToken = String(token || '').toLowerCase();
      const target = normalizedToken === 'share_1' ? share : recreatedShare?.token?.toLowerCase() === normalizedToken ? recreatedShare : null;
      if (!target || deletedShareToken?.toLowerCase?.() === normalizedToken) return null;
      return options.includeSensitive ? target : { ...target, accessCodeHash: undefined };
    },
    markShareAccessGranted: async () => share,
    listPhotosForShare: async (token) => photos.filter((photo) => photo.shareToken === token && !photo.deletedAt),
    listPhotosForShareByIds: async (token, photoIds) => {
      const visible = photos.filter((photo) => photo.shareToken === token && !photo.deletedAt);
      const byId = new Map(visible.map((photo) => [photo.id, photo]));
      return photoIds.map((photoId) => byId.get(photoId)).filter(Boolean);
    },
    listPhotosForSharePage: async (token, options = {}) => {
      const limit = normalizePhotoPageLimit(options.limit);
      const cursor = decodePhotoCursor(options.cursor);
      const visible = photos
        .filter((photo) => photo.shareToken === token && !photo.deletedAt)
        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)));
      const afterCursor = cursor
        ? visible.filter((photo) => String(photo.createdAt) > cursor.createdAt || (String(photo.createdAt) === cursor.createdAt && String(photo.id) > cursor.id))
        : visible;
      return buildPhotoPage(afterCursor.slice(0, limit + 1), limit, visible.length);
    },
    countPhotosForShare: async (token) => photos.filter((photo) => photo.shareToken === token && !photo.deletedAt).length,
    getPhoto: async (photoId) => photos.find((photo) => photo.id === photoId && !photo.deletedAt) || null,
    createPhotos: async (payload) => {
      const created = payload.map((photo, index) => ({
        ...photo,
        createdAt: photo.createdAt || new Date(Date.now() + index).toISOString(),
      }));
      photos = [...photos, ...created];
      return created;
    },
    createShareSession: async (payload) => {
      recreatedShare = {
        token: payload.token,
        galleryId: payload.galleryId || payload.token,
        accessCodeHash: payload.accessCodeHash,
        accessCode: payload.accessCode,
        packageType: payload.packageType,
        phone: payload.phone,
        clientName: payload.clientName || '',
        clientEmail: payload.clientEmail || '',
        galleryName: payload.galleryName || '',
        galleryDescription: payload.galleryDescription || '',
        photoCount: payload.photoCount,
        subtotal: payload.subtotal ?? payload.total,
        discountAmount: payload.discountAmount || 0,
        total: payload.total,
        createdAt: new Date().toISOString(),
        expiresAt: payload.expiresAt.toISOString(),
        revokedAt: null,
        status: 'active',
        link: payload.link,
        sales: emptySales(),
      };
      photos = photos.map((photo) => (payload.photoIds.includes(photo.id) ? { ...photo, shareToken: payload.token } : photo));
      return recreatedShare;
    },
    findShareWithExactPhotos: async (photoIds) => {
      const selected = new Set(photoIds);
      const candidates = [share, recreatedShare].filter(Boolean);
      return candidates.find((candidate) => {
        const visibleIds = photos
          .filter((photo) => photo.shareToken === candidate.token && !photo.deletedAt)
          .map((photo) => photo.id);
        return visibleIds.length === selected.size && visibleIds.every((photoId) => selected.has(photoId));
      }) || null;
    },
    restoreShareSession: async (token, updates) => {
      const target = token === share.token ? share : recreatedShare?.token === token ? recreatedShare : null;
      if (!target) return null;
      const restored = {
        ...target,
        accessCodeHash: updates.accessCodeHash || target.accessCodeHash,
        accessCode: updates.accessCode || target.accessCode,
        packageType: updates.packageType || target.packageType,
        phone: updates.phone || target.phone,
        clientName: updates.clientName === undefined ? target.clientName : updates.clientName,
        clientEmail: updates.clientEmail === undefined ? target.clientEmail : updates.clientEmail,
        galleryName: updates.galleryName === undefined ? target.galleryName : updates.galleryName,
        galleryDescription: updates.galleryDescription === undefined ? target.galleryDescription : updates.galleryDescription,
        photoCount: photos.filter((photo) => photo.shareToken === token && !photo.deletedAt).length,
        subtotal: updates.subtotal === undefined ? target.subtotal : updates.subtotal,
        discountAmount: updates.discountAmount === undefined ? target.discountAmount : updates.discountAmount,
        total: updates.total === undefined ? target.total : updates.total,
        expiresAt: updates.expiresAt.toISOString(),
        retentionExpiresAt: updates.retentionExpiresAt?.toISOString?.() || updates.retentionExpiresAt || target.retentionExpiresAt,
        revokedAt: null,
        deletedAt: null,
        status: 'active',
        link: updates.link || target.link,
      };
      if (token === share.token) share = restored;
      if (recreatedShare?.token === token) recreatedShare = restored;
      if (deletedShareToken === token) deletedShareToken = null;
      return restored;
    },
    reactivateShareSession: async (token, updates) => {
      if (token !== 'share_1') return null;
      share = {
        ...share,
        accessCodeHash: updates.accessCodeHash || share.accessCodeHash,
        accessCode: updates.accessCode || share.accessCode,
        expiresAt: updates.expiresAt.toISOString(),
        retentionExpiresAt: updates.retentionExpiresAt?.toISOString?.() || updates.retentionExpiresAt || share.retentionExpiresAt,
        revokedAt: null,
        status: 'active',
        link: share.link || updates.link,
        photoCount: photos.filter((photo) => photo.shareToken === token && !photo.deletedAt).length,
      };
      return share;
    },
    findShareWithMatchingMetadata: async () => null,
    deleteDetachedShareDuplicates: async () => [],
    deleteShareSession: async (token) => {
      if (token !== 'share_1') return null;
      deletedShareToken = token;
      share = { ...share, deletedAt: new Date().toISOString() };
      for (const session of sessions.values()) {
        const hasSharePhoto = photos.some((photo) => photo.sessionId === session.id && photo.shareToken === token);
        if ((session.shareToken === token || hasSharePhoto) && session.status === 'pending') {
          session.status = 'cancelled';
          session.deliveryStatus = 'cancelled';
          session.deliveryError = 'Galeria removida pelo administrador.';
        }
      }
      return share;
    },
    deletePhotoFromShare: async (token, photoId) => {
      const photo = photos.find((item) => item.shareToken === token && item.id === photoId && !item.deletedAt);
      if (!photo) return null;
      photo.deletedAt = new Date().toISOString();
      return photo;
    },
    refreshSharePhotoCount: async (token) => {
      if (token !== 'share_1') return null;
      share = {
        ...share,
        photoCount: photos.filter((photo) => photo.shareToken === token && !photo.deletedAt).length,
      };
      return share;
    },
    updateShareSession: async (token, updates) => {
      if (token !== 'share_1') return null;
      share = {
        ...share,
        phone: updates.phone || share.phone,
        clientName: updates.clientName === undefined ? share.clientName : updates.clientName,
        clientEmail: updates.clientEmail === undefined ? share.clientEmail : updates.clientEmail,
        galleryName: updates.galleryName === undefined ? share.galleryName : updates.galleryName,
        galleryDescription: updates.galleryDescription === undefined ? share.galleryDescription : updates.galleryDescription,
        packageType: updates.packageType || share.packageType,
        subtotal: updates.subtotal === undefined ? share.subtotal : updates.subtotal,
        discountAmount: updates.discountAmount === undefined ? share.discountAmount : updates.discountAmount,
        total: updates.total === undefined ? share.total : updates.total,
        expiresAt: updates.expiresAt ? updates.expiresAt.toISOString() : share.expiresAt,
        accessCode: updates.accessCode || share.accessCode,
        accessCodeHash: updates.accessCodeHash || share.accessCodeHash,
        revokedAt: updates.expiresAt ? null : share.revokedAt,
        status: updates.expiresAt ? 'active' : share.status,
      };
      return share;
    },
    createSession: async (session, photoIds = []) => {
      const stored = {
        id: session.id,
        amount: session.amount,
        subtotal: session.subtotal === undefined ? session.amount : session.subtotal,
        discountAmount: session.discountAmount || 0,
        photoCount: session.photoCount,
        packageType: session.packageType,
        phone: session.phone,
        clientName: session.clientName || '',
        clientEmail: session.clientEmail || '',
        status: session.status,
        paymentMethod: session.paymentMethod,
        shareToken: session.shareToken || null,
        deliveryStatus: session.deliveryStatus,
      };
      sessions.set(stored.id, stored);
      if (photoIds.length) {
        photos = photos.map((photo) => (photoIds.includes(photo.id) ? { ...photo, sessionId: stored.id } : photo));
      }
      return stored;
    },
    clearSalesStats: async () => {
      const deletedSessions = sessions.size;
      sessions.clear();
      return { deletedSessions };
    },
    approveSession: async (sessionId) => {
      const session = sessions.get(sessionId);
      if (!session) return null;
      if (session.status === 'cancelled') return null;
      session.status = 'approved';
      session.deliveryStatus = 'queued';
      if (session.shareToken === share.token) {
        share = {
          ...share,
          sales: {
            soldPhotoCount: (share.sales?.soldPhotoCount || 0) + Number(session.photoCount || 0),
            soldOrderCount: (share.sales?.soldOrderCount || 0) + 1,
            soldAmount: (share.sales?.soldAmount || 0) + Number(session.amount || 0),
            lastSoldAt: new Date().toISOString(),
          },
        };
      }
      return session;
    },
    cancelManualSessionRelease: async (sessionId) => {
      const session = sessions.get(sessionId);
      if (!session || session.status === 'approved' || session.paymentMethod !== 'Dinheiro/Cartão') return null;
      session.status = 'cancelled';
      session.deliveryStatus = 'cancelled';
      session.deliveryError = 'Liberação cancelada pelo administrador.';
      return session;
    },
    getSession: async (sessionId) => sessions.get(sessionId) || null,
    retryDeliveryForSession: async (sessionId) => ({ id: 77, session_id: sessionId, status: 'pending' }),
    updateDeliveryStatus: async (sessionId, status, error = null) => {
      const session = sessions.get(sessionId);
      if (!session) return null;
      session.deliveryStatus = status;
      session.deliveryError = error;
      return session;
    },
  };
  const retention = {
    getSettings: async () => ({
      defaultGalleryRetentionDays: 30,
      deliveredPhotoRetentionDays: 30,
      expiredShareRetentionDays: 7,
      archiveBeforeDelete: false,
      autoCleanupEnabled: false,
    }),
    updateSettings: async (settings) => ({
      defaultGalleryRetentionDays: settings.defaultGalleryRetentionDays || 30,
      deliveredPhotoRetentionDays: 30,
      expiredShareRetentionDays: settings.expiredShareRetentionDays || 7,
      archiveBeforeDelete: Boolean(settings.archiveBeforeDelete),
      autoCleanupEnabled: Boolean(settings.autoCleanupEnabled),
    }),
  };
  const packages = {
    getSettings: async () => ({
      eventos: {
        label: 'Pacote 5+ fotos',
        shortLabel: 'Eventos',
        description: 'R$ 15 por foto.',
        unit: 15,
        bulk: 10,
        threshold: 5,
      },
    }),
    updateSettings: async (settings) => settings,
  };
  const credentials = {
    getSecretValue: async (key) => (key === 'publicBaseUrl' ? 'https://snapflow-tail.example' : ''),
    listCredentials: async () => ({
      api: [{ key: 'mpAccessToken', configured: true, maskedValue: '••••1234' }],
      profile: [{ key: 'photographerName', configured: true, maskedValue: 'Ramon' }],
    }),
    updateCredential: async (key, body) => {
      if (body.confirmation !== 'admin-secret') {
        const error = new Error('Confirmação administrativa inválida.');
        error.status = 401;
        error.code = 'credential_confirmation_invalid';
        throw error;
      }
      return { key, configured: true, maskedValue: key === 'mpAccessToken' ? '••••4321' : body.value };
    },
    deleteCredential: async (key, body) => {
      if (body.confirmation !== 'admin-secret') {
        const error = new Error('Confirmação administrativa inválida.');
        error.status = 401;
        error.code = 'credential_confirmation_invalid';
        throw error;
      }
      return { key, configured: false, maskedValue: '' };
    },
  };

  const payment = {
    createPixPayment: async (payload) => {
      await repos.createSession(
        {
          id: payload.sessionId,
          amount: payload.total,
          subtotal: payload.subtotal === undefined ? payload.total : payload.subtotal,
          discountAmount: payload.discountAmount || 0,
          photoCount: payload.count,
          packageType: payload.packageType,
          phone: payload.phone,
          clientName: payload.clientName || '',
          clientEmail: payload.clientEmail || '',
          status: 'pending',
          paymentMethod: 'PIX',
          paymentId: 'payment_1',
          shareToken: payload.shareToken || null,
          deliveryStatus: 'idle',
        },
        payload.photoIds
      );

      return {
        qr_code: 'pix-code',
        qr_code_base64: 'pix-base64',
        payment_id: 'payment_1',
        sessionId: payload.sessionId,
        shareToken: payload.shareToken,
        total: payload.total,
      };
    },
  };
  const whatsappTemplates = {
    getSettings: async () => whatsappTemplateSettings,
    updateSettings: async (settings) => {
      whatsappTemplateSettings = {
        ...whatsappTemplateSettings,
        ...settings,
      };
      return whatsappTemplateSettings;
    },
    renderShareLinkMessage: async ({ link, accessCode, name }) => `Abra ${name || 'cliente'}: ${link}\nCódigo ${accessCode}`,
    renderPaymentWaitingMessage: async () => 'Aguardando pagamento.',
    renderDeliveryThanksMessage: async () => 'Obrigado pela compra!',
  };

  return createApp({
    config: {
      adminAccessToken: 'admin-secret',
      maxFilesPerUpload: 100,
      maxUploadMb: 1,
      defaultGalleryRetentionDays: 30,
      publicBaseUrl: 'http://localhost:5173',
    },
    repos,
    media: {
      tempDir: () => __dirname,
      maxUploadBytes: 1024,
      allowedMimeTypes: new Set(['image/jpeg']),
      processUploadedFiles: async (files, retentionExpiresAt) => {
        await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
        return files.map((file, index) => ({
          id: `uploaded_${index + 1}`,
          originalPath: `originals/uploaded_${index + 1}.jpg`,
          thumbPath: `thumbs/uploaded_${index + 1}.jpg`,
          previewPath: `previews/uploaded_${index + 1}.jpg`,
          mimeType: file.mimetype,
          sizeBytes: file.size || 10,
          retentionExpiresAt,
        }));
      },
      removeOrArchive: async () => ({ bytes: 300, errors: [] }),
    },
    payment,
    credentials,
    deliveryQueue,
    packages,
    retention,
    whatsapp,
    whatsappTemplates,
  });
}

test('admin access check only accepts the correct bearer token', async () => {
  const invalid = await request(createTestApp())
    .get('/api/admin/access')
    .set('Authorization', 'Bearer wrong-token');
  assert.equal(invalid.status, 401);

  const valid = await request(createTestApp())
    .get('/api/admin/access')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(valid.status, 200);
  assert.equal(valid.body.ok, true);
});

test('admin lock duration is bounded between 30 and 60 minutes', () => {
  assert.equal(lockMsFromConfig({ adminLockMinutes: 5 }), 30 * 60 * 1000);
  assert.equal(lockMsFromConfig({ adminLockMinutes: 45 }), 45 * 60 * 1000);
  assert.equal(lockMsFromConfig({ adminLockMinutes: 90 }), 60 * 60 * 1000);
});

test('admin access locks after five invalid attempts', async () => {
  const app = createTestApp();

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await request(app)
      .get('/api/admin/access')
      .set('Authorization', `Bearer wrong-token-${attempt}`);
    assert.equal(response.status, 401);
    assert.equal(response.body.details.attemptsRemaining, 5 - attempt);
  }

  const locked = await request(app)
    .get('/api/admin/access')
    .set('Authorization', 'Bearer wrong-token-5');
  assert.equal(locked.status, 429);
  assert.equal(locked.body.code, 'admin_locked');
  assert.equal(locked.body.details.cooldownMinutes, 30);
  assert.match(locked.body.details.lockedUntil, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Number(locked.body.details.retryAfterSeconds) > 0);
  assert.ok(Number(locked.body.details.retryAfterSeconds) <= 30 * 60);
  assert.equal(locked.headers['retry-after'], String(locked.body.details.retryAfterSeconds));

  const stillLocked = await request(app)
    .get('/api/admin/access')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(stillLocked.status, 429);
  assert.equal(stillLocked.body.details.cooldownMinutes, 30);
});

test('admin dashboard rejects missing bearer token', async () => {
  const response = await request(createTestApp()).get('/api/admin/dashboard');
  assert.equal(response.status, 401);
});

test('unknown API routes return JSON instead of Express HTML', async () => {
  const response = await request(createTestApp())
    .post('/api/admin/share-sessions/missing/unknown-action')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(response.status, 404);
  assert.equal(response.body.code, 'api_route_not_found');
  assert.match(response.body.error, /Rota da API não encontrada/);
});

test('admin dashboard accepts bearer token and does not expose managementKey', async () => {
  const response = await request(createTestApp())
    .get('/api/admin/dashboard')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(response.status, 200);
  assert.equal(response.body.shareRecent[0].managementKey, undefined);
  assert.equal(response.body.shareRecent[0].galleryName, 'Galeria Família');
  assert.equal(response.body.shareRecent[0].galleryDescription, 'Seleção final do aniversário');
  assert.equal(response.body.shareRecent[0].sales.soldPhotoCount, 0);
  assert.ok(response.body.stats.ano);
  assert.ok(response.body.chartSeries);
});

test('admin manual cash/card payment stays pending until explicit approval', async () => {
  const enqueued = [];
  const app = createTestApp({ deliveryQueue: { enqueue: async (id) => enqueued.push(id) } });

  const pending = await request(app)
    .post('/api/admin/manual-payment')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      sessionId: 'manual_1',
      total: 30,
      count: 2,
      phone: '11999999999',
      clientName: 'Ana Cliente',
      clientEmail: 'ana@cliente.com',
      packageType: 'eventos',
      photoIds: ['photo_1'],
    });

  assert.equal(pending.status, 200);
  assert.equal(pending.body.sessionId, 'manual_1');
  assert.equal(pending.body.status, 'pending');
  assert.equal(pending.body.deliveryStatus, 'idle');
  assert.deepEqual(enqueued, []);
  const storedPending = await request(app)
    .get('/api/admin/session/manual_1')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(storedPending.body.clientName, 'Ana Cliente');
  assert.equal(storedPending.body.clientEmail, 'ana@cliente.com');

  const approved = await request(app)
    .post('/api/admin/approve-manual-session/manual_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(approved.status, 200);
  assert.equal(approved.body.session.status, 'approved');
  assert.deepEqual(enqueued, ['manual_1']);

  const duplicate = await request(app)
    .post('/api/admin/approve-manual-session/manual_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.alreadyApproved, true);
  assert.deepEqual(enqueued, ['manual_1']);
});

test('admin can cancel a pending manual release and cannot approve it afterwards', async () => {
  const enqueued = [];
  const app = createTestApp({ deliveryQueue: { enqueue: async (id) => enqueued.push(id) } });

  await request(app)
    .post('/api/admin/manual-payment')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      sessionId: 'manual_cancel',
      total: 30,
      count: 2,
      phone: '11999999999',
      clientName: 'Ana Cliente',
      packageType: 'eventos',
      photoIds: ['photo_1'],
    });

  const cancelled = await request(app)
    .post('/api/admin/sessions/manual_cancel/cancel-release')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.session.status, 'cancelled');
  assert.equal(cancelled.body.session.deliveryStatus, 'cancelled');
  assert.equal(cancelled.body.session.deliveryError, 'Liberação cancelada pelo administrador.');
  assert.deepEqual(enqueued, []);

  const duplicate = await request(app)
    .post('/api/admin/sessions/manual_cancel/cancel-release')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.session.status, 'cancelled');

  const approve = await request(app)
    .post('/api/admin/approve-manual-session/manual_cancel')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(approve.status, 409);
  assert.equal(approve.body.code, 'session_release_cancelled');
  assert.deepEqual(enqueued, []);
});

test('admin cannot cancel a release after approval', async () => {
  const app = createTestApp();

  await request(app)
    .post('/api/admin/manual-payment')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      sessionId: 'manual_approved',
      total: 30,
      count: 2,
      phone: '11999999999',
      packageType: 'eventos',
      photoIds: ['photo_1'],
    });
  await request(app)
    .post('/api/admin/approve-manual-session/manual_approved')
    .set('Authorization', 'Bearer admin-secret');

  const response = await request(app)
    .post('/api/admin/sessions/manual_approved/cancel-release')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'session_already_approved');
});

test('admin share link creation sends WhatsApp and returns send metadata', async () => {
  const sends = [];
  const app = createTestApp({ whatsapp: { sendText: async (phone, message) => sends.push({ phone, message }) } });

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      clientEmail: 'ana@cliente.com',
      galleryName: 'Formatura 2026',
      galleryDescription: 'Galeria liberada para escolha das famílias.',
      packageType: 'eventos',
      count: 1,
      total: 10,
      expiresMinutes: 30,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.whatsappSent, true);
  assert.equal(response.body.whatsappStatus, 'sent');
  assert.equal(response.body.clientName, 'Ana Cliente');
  assert.equal(response.body.clientEmail, 'ana@cliente.com');
  assert.equal(response.body.galleryName, 'Formatura 2026');
  assert.equal(response.body.galleryDescription, 'Galeria liberada para escolha das famílias.');
  assert.equal(response.body.sales.soldPhotoCount, 0);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].phone, '+55 11999999999');
  assert.match(sends[0].message, /Ana Cliente/);
  assert.match(sends[0].message, /Código/);
});

test('admin share link creation stores manual discount metadata', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      packageType: 'eventos',
      count: 1,
      subtotal: 10,
      discountAmount: 3,
      total: 7,
      expiresMinutes: 30,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.subtotal, 10);
  assert.equal(response.body.discountAmount, 3);
  assert.equal(response.body.total, 7);
});

test('admin share link creation restores the existing gallery for the same photo set', async () => {
  const sends = [];
  const app = createTestApp({
    initialDeletedShareToken: 'share_1',
    whatsapp: { sendText: async (phone, message) => sends.push({ phone, message }) },
  });

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      packageType: 'eventos',
      count: 1,
      total: 10,
      expiresMinutes: 30,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.token, 'share_1');
  assert.equal(response.body.galleryId, 'gallery_1');
  assert.equal(response.body.accessCode, '1234');
  assert.equal(response.body.link, 'https://snapflow-tail.example/s/share_1');
  assert.equal(sends.length, 1);

  const dashboard = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(dashboard.body.shareRecent.length, 1);
  assert.equal(dashboard.body.shareRecent[0].token, 'share_1');
});

test('admin share link creation keeps link when WhatsApp send fails', async () => {
  const app = createTestApp({
    whatsapp: {
      sendText: async () => {
        throw new Error('WhatsApp offline');
      },
    },
  });

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: '11999999999',
      clientName: 'Ana Cliente',
      clientEmail: 'ana@cliente.com',
      packageType: 'eventos',
      count: 1,
      total: 10,
      expiresMinutes: 30,
    });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.whatsappSent, false);
  assert.equal(response.body.whatsappStatus, 'failed');
  assert.match(response.body.whatsappError, /WhatsApp offline/);
});

test('admin share link creation keeps link when WhatsApp Web loses its controlled frame', async () => {
  const app = createTestApp({
    whatsapp: {
      sendText: async () => {
        throw new Error("Attempted to use detached Frame 'abc'.");
      },
    },
  });

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: { countryCode: '54', localNumber: '91159099286' },
      clientName: 'Cliente Argentina',
      packageType: 'eventos',
      count: 1,
      total: 10,
      expiresMinutes: 30,
    });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.whatsappSent, false);
  assert.equal(response.body.whatsappStatus, 'failed');
  assert.match(response.body.whatsappError, /O WhatsApp Web perdeu a conexão controlada pelo SnapFlow/);
});

test('admin share link creation sends WhatsApp with the editable international DDI preserved', async () => {
  const sends = [];
  const app = createTestApp({ whatsapp: { sendText: async (phone, message) => sends.push({ phone, message }) } });

  const response = await request(app)
    .post('/api/admin/share-session')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      photoIds: ['photo_1'],
      phone: { countryCode: '54', localNumber: '91159099286' },
      clientName: 'Cliente Argentina',
      packageType: 'eventos',
      count: 1,
      total: 10,
      expiresMinutes: 30,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.whatsappSent, true);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].phone, '+54 91159099286');
});

test('admin can inspect and request WhatsApp reconnect', async () => {
  let reconnects = 0;
  const app = createTestApp({
    whatsapp: {
      getStatus: () => ({ ready: false, status: reconnects ? 'initializing' : 'failed', lastError: 'context lost', hasQr: true, qr: 'pairing-payload' }),
      reconnect: async () => {
        reconnects += 1;
      },
      resetAuth: async () => ({ ready: false, status: 'initializing', lastError: null }),
      sendText: async () => {},
    },
  });

  const status = await request(app)
    .get('/api/admin/whatsapp/status')
    .set('Authorization', 'Bearer admin-secret');
  const reconnect = await request(app)
    .post('/api/admin/whatsapp/reconnect')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(status.status, 200);
  assert.equal(status.body.status, 'failed');
  assert.equal(status.body.qr, 'pairing-payload');
  assert.equal(reconnect.status, 202);
  assert.ok(['failed', 'initializing'].includes(reconnect.body.status));
  assert.equal(reconnects, 1);
});

test('admin can reset WhatsApp local auth for re-pairing', async () => {
  let resets = 0;
  const app = createTestApp({
    whatsapp: {
      getStatus: () => ({ ready: false, status: 'failed', lastError: 'context lost' }),
      reconnect: async () => {},
      resetAuth: async () => {
        resets += 1;
        return { ready: false, status: 'initializing', lastError: null };
      },
      sendText: async () => {},
    },
  });

  const response = await request(app)
    .post('/api/admin/whatsapp/reset-auth')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(response.status, 202);
  assert.equal(response.body.status, 'initializing');
  assert.equal(resets, 1);
});

test('admin can retry failed delivery for an approved session', async () => {
  const app = createTestApp();
  await request(app)
    .post('/api/admin/manual-payment')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      sessionId: 'manual_retry',
      total: 30,
      count: 2,
      phone: '11999999999',
      packageType: 'eventos',
      photoIds: ['photo_1'],
    });
  await request(app)
    .post('/api/admin/approve-manual-session/manual_retry')
    .set('Authorization', 'Bearer admin-secret');

  const response = await request(app)
    .post('/api/admin/sessions/manual_retry/retry-delivery')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.job.session_id, 'manual_retry');
});

test('admin can clear sales statistics without deleting galleries', async () => {
  const app = createTestApp();
  await request(app)
    .post('/api/admin/manual-payment')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      sessionId: 'manual_clear',
      total: 30,
      count: 2,
      phone: '11999999999',
      packageType: 'eventos',
      photoIds: ['photo_1'],
    });

  const cleared = await request(app)
    .post('/api/admin/stats/clear')
    .set('Authorization', 'Bearer admin-secret');
  const gallery = await request(app)
    .get('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.deletedSessions, 1);
  assert.equal(gallery.status, 200);
  assert.equal(gallery.body.token, 'share_1');
});

test('admin delete hides a shared link from dashboard lists', async () => {
  const app = createTestApp();
  const deleted = await request(app)
    .delete('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.success, true);

  const dashboard = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(dashboard.body.shareRecent.length, 0);
});

test('admin delete cancels and hides pending sales for that shared gallery', async () => {
  const app = createTestApp();
  await request(app)
    .post('/api/admin/manual-payment')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      sessionId: 'gallery_pending_sale',
      total: 30,
      count: 2,
      phone: '11999999999',
      packageType: 'eventos',
      shareToken: 'share_1',
      photoIds: ['photo_1'],
    });

  const beforeDelete = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(beforeDelete.body.recent.some((session) => session.id === 'gallery_pending_sale'), true);

  const deleted = await request(app)
    .delete('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(deleted.status, 200);
  const storedSession = await request(app)
    .get('/api/admin/session/gallery_pending_sale')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(storedSession.body.status, 'cancelled');
  assert.equal(storedSession.body.deliveryStatus, 'cancelled');

  const afterDelete = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(afterDelete.body.recent.some((session) => session.id === 'gallery_pending_sale'), false);
});

test('admin delete hides pending sales linked only through gallery photos', async () => {
  const app = createTestApp();
  await request(app)
    .post('/api/admin/manual-payment')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      sessionId: 'gallery_photo_pending_sale',
      total: 30,
      count: 1,
      phone: '11999999999',
      packageType: 'eventos',
      photoIds: ['photo_1'],
    });

  const beforeDelete = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(beforeDelete.body.recent.some((session) => session.id === 'gallery_photo_pending_sale'), true);

  await request(app)
    .delete('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  const storedSession = await request(app)
    .get('/api/admin/session/gallery_photo_pending_sale')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(storedSession.body.status, 'cancelled');

  const afterDelete = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(afterDelete.body.recent.some((session) => session.id === 'gallery_photo_pending_sale'), false);
});

test('admin delete hides approved sales from recent when their gallery is gone', async () => {
  const app = createTestApp();
  await request(app)
    .post('/api/admin/manual-payment')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      sessionId: 'gallery_approved_sale',
      total: 30,
      count: 1,
      phone: '11999999999',
      packageType: 'eventos',
      shareToken: 'share_1',
      photoIds: ['photo_1'],
    });
  await request(app)
    .post('/api/admin/approve-manual-session/gallery_approved_sale')
    .set('Authorization', 'Bearer admin-secret');

  const beforeDelete = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(beforeDelete.body.recent.some((session) => session.id === 'gallery_approved_sale'), true);

  await request(app)
    .delete('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  const afterDelete = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(afterDelete.body.recent.some((session) => session.id === 'gallery_approved_sale'), false);
});

test('admin recreate revalidates the same gallery link and code', async () => {
  const response = await request(createTestApp())
    .post('/api/admin/share-sessions/share_1/recreate')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(response.status, 200);
  assert.equal(response.body.token, 'share_1');
  assert.equal(response.body.galleryId, 'gallery_1');
  assert.equal(response.body.link, 'http://localhost:5173/s/share_1');
  assert.equal(response.body.accessCode, '1234');
  assert.match(response.body.whatsappMessage, /Código 1234/);
});

test('admin gallery details expose only that gallery photos for editing', async () => {
  const response = await request(createTestApp())
    .get('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(response.status, 200);
  assert.equal(response.body.token, 'share_1');
  assert.equal(response.body.photoCount, 1);
  assert.equal(response.body.galleryName, 'Galeria Família');
  assert.equal(response.body.galleryDescription, 'Seleção final do aniversário');
  assert.deepEqual(response.body.sales, {
    soldPhotoCount: 0,
    soldOrderCount: 0,
    soldAmount: 0,
    lastSoldAt: null,
  });
  assert.equal(response.body.photos.length, 1);
  assert.equal(response.body.photos[0].id, 'photo_1');
  assert.match(response.body.photos[0].thumbUrl, /\/api\/media\/photo_1\/thumb/);
});

test('admin gallery details return a paginated first photo page', async () => {
  const initialPhotos = Array.from({ length: 45 }, (_, index) => ({
    id: `photo_${String(index + 1).padStart(2, '0')}`,
    shareToken: 'share_1',
    sizeBytes: 100,
    createdAt: new Date(Date.now() + index * 1000).toISOString(),
  }));
  const response = await request(createTestApp({ initialPhotos }))
    .get('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(response.status, 200);
  assert.equal(response.body.photos.length, 40);
  assert.equal(response.body.photosPage.hasMore, true);
  assert.equal(response.body.photosPage.totalCount, 45);
  assert.equal(response.body.photoCount, 45);
});

test('admin can load the next gallery photo page', async () => {
  const initialPhotos = Array.from({ length: 45 }, (_, index) => ({
    id: `photo_${String(index + 1).padStart(2, '0')}`,
    shareToken: 'share_1',
    sizeBytes: 100,
    createdAt: new Date(Date.now() + index * 1000).toISOString(),
  }));
  const app = createTestApp({ initialPhotos });
  const first = await request(app)
    .get('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  const response = await request(app)
    .get('/api/admin/share-sessions/share_1/photos')
    .query({ cursor: first.body.photosPage.nextCursor })
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(response.status, 200);
  assert.equal(response.body.photos.length, 5);
  assert.equal(response.body.photosPage.hasMore, false);
});

test('admin can upload and delete photos inside a shared gallery', async () => {
  const app = createTestApp();
  const upload = await request(app)
    .post('/api/admin/share-sessions/share_1/photos')
    .set('Authorization', 'Bearer admin-secret')
    .attach('photos', Buffer.from('fake-jpeg'), {
      filename: 'nova.jpg',
      contentType: 'image/jpeg',
    });

  assert.equal(upload.status, 200);
  assert.equal(upload.body.photoCount, 2);
  assert.equal(upload.body.photos.at(-1).id, 'uploaded_1');

  const deleted = await request(app)
    .delete('/api/admin/share-sessions/share_1/photos/uploaded_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.success, true);

  const details = await request(app)
    .get('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(details.body.photoCount, 1);
  assert.equal(details.body.photos.some((photo) => photo.id === 'uploaded_1'), false);
});

test('admin can edit shared gallery metadata and visible access code', async () => {
  const response = await request(createTestApp())
    .patch('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      phone: '+55 11988888888',
      clientName: 'Bruna Cliente',
      clientEmail: 'bruna@cliente.com',
      galleryName: 'Ensaio editado',
      galleryDescription: 'Entrega revisada para o cliente.',
      packageType: 'eventos',
      count: 5,
      subtotal: 42,
      discountAmount: 5,
      total: 37,
      accessCode: 'ab12',
      expiresMinutes: 20,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.phone, '+55 11988888888');
  assert.equal(response.body.clientName, 'Bruna Cliente');
  assert.equal(response.body.clientEmail, 'bruna@cliente.com');
  assert.equal(response.body.galleryName, 'Ensaio editado');
  assert.equal(response.body.galleryDescription, 'Entrega revisada para o cliente.');
  assert.equal(response.body.packageType, 'eventos');
  assert.equal(response.body.subtotal, 42);
  assert.equal(response.body.discountAmount, 5);
  assert.equal(response.body.total, 37);
  assert.equal(response.body.accessCode, 'AB12');
});

test('admin can clear shared gallery name and description', async () => {
  const response = await request(createTestApp())
    .patch('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      galleryName: '',
      galleryDescription: '',
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.galleryName, '');
  assert.equal(response.body.galleryDescription, '');
});

test('admin retention settings route saves with a valid token', async () => {
  const response = await request(createTestApp())
    .put('/api/admin/settings/retention')
    .set('Authorization', 'Bearer admin-secret')
    .send({ defaultGalleryRetentionDays: 14, archiveBeforeDelete: true });

  assert.equal(response.status, 200);
  assert.equal(response.body.defaultGalleryRetentionDays, 14);
  assert.equal(response.body.archiveBeforeDelete, true);
});

test('admin package settings route saves with a valid token', async () => {
  const response = await request(createTestApp())
    .put('/api/admin/settings/packages')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      eventos: {
        label: 'Pacote editado',
        shortLabel: 'Editado',
        description: 'Teste',
        unit: 20,
        bulk: 12,
        threshold: 4,
      },
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.eventos.label, 'Pacote editado');
});

test('admin WhatsApp message settings are editable with a valid token', async () => {
  const app = createTestApp();
  const list = await request(app)
    .get('/api/admin/settings/whatsapp-messages')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(list.status, 200);
  assert.match(list.body.shareLink.body, /\{link\}/);

  const saved = await request(app)
    .put('/api/admin/settings/whatsapp-messages')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      shareLink: { body: 'Mensagem nova {link}' },
      paymentWaiting: { body: 'Aguardando {linkText}' },
      deliveryThanks: { body: 'Obrigado {count}' },
    });

  assert.equal(saved.status, 200);
  assert.equal(saved.body.shareLink.body, 'Mensagem nova {link}');
});

test('admin credentials are masked and require confirmation for mutations', async () => {
  const app = createTestApp();
  const list = await request(app)
    .get('/api/admin/credentials')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(list.status, 200);
  assert.equal(list.body.api[0].maskedValue, '••••1234');

  const denied = await request(app)
    .put('/api/admin/credentials/mpAccessToken')
    .set('Authorization', 'Bearer admin-secret')
    .send({ value: 'APP_USR_secret', confirmation: 'wrong' });

  assert.equal(denied.status, 401);

  const saved = await request(app)
    .put('/api/admin/credentials/mpAccessToken')
    .set('Authorization', 'Bearer admin-secret')
    .send({ value: 'APP_USR_secret4321', confirmation: 'admin-secret' });

  assert.equal(saved.status, 200);
  assert.equal(saved.body.maskedValue, '••••4321');
});

test('public package settings are readable without admin token', async () => {
  const response = await request(createTestApp()).get('/api/packages');

  assert.equal(response.status, 200);
  assert.equal(response.body.eventos.threshold, 5);
});

test('admin upload returns verbose file size failures', async () => {
  const response = await request(createTestApp())
    .post('/api/admin/upload')
    .set('Authorization', 'Bearer admin-secret')
    .attach('photos', Buffer.alloc(2048), {
      filename: 'grande.jpg',
      contentType: 'image/jpeg',
    });

  assert.equal(response.status, 413);
  assert.equal(response.body.code, 'upload_file_too_large');
  assert.match(response.body.error, /limite de 1 MB/);
});

test('share metadata hides photo urls before unlock', async () => {
  const response = await request(createTestApp()).get('/api/share-session/share_1');

  assert.equal(response.status, 200);
  assert.equal(response.body.clientName, 'Ana Cliente');
  assert.equal(response.body.clientEmail, '');
  assert.equal(response.body.galleryName, 'Galeria Família');
  assert.equal(response.body.galleryDescription, 'Seleção final do aniversário');
  assert.equal(response.body.subtotal, 10);
  assert.equal(response.body.discountAmount, 0);
  assert.equal(response.body.total, 10);
  assert.equal(response.body.photos, undefined);
  assert.equal(response.body.thumbUrls, undefined);
});

test('share metadata tolerates token casing differences in copied links', async () => {
  const response = await request(createTestApp()).get('/api/share-session/SHARE_1');

  assert.equal(response.status, 200);
  assert.equal(response.body.token, 'share_1');
});

test('approved shared sales update gallery sales metadata', async () => {
  const app = createTestApp();
  const unlock = await request(app)
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  const pending = await request(app)
    .post('/api/share-session/share_1/manual-payment')
    .set('Authorization', `Bearer ${unlock.body.customerAccessToken}`)
    .send({
      sessionId: 'share_sale_1',
      photoIds: ['photo_1'],
      phone: '11999999999',
    });
  assert.equal(pending.status, 200);

  await request(app)
    .post('/api/admin/approve-manual-session/share_sale_1')
    .set('Authorization', 'Bearer admin-secret');

  const details = await request(app)
    .get('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(details.status, 200);
  assert.equal(details.body.sales.soldPhotoCount, 1);
  assert.equal(details.body.sales.soldOrderCount, 1);
  assert.equal(details.body.sales.soldAmount, 15);
  assert.ok(details.body.sales.lastSoldAt);
});

test('admin Pix route rejects malformed client emails with a clear validation error', async () => {
  const response = await request(createTestApp())
    .post('/api/admin/pix')
    .set('Authorization', 'Bearer admin-secret')
    .send({
      sessionId: 'pix_invalid_email',
      total: 30,
      count: 2,
      phone: '11999999999',
      clientName: 'Ana Cliente',
      clientEmail: 'email-invalido',
      packageType: 'eventos',
      photoIds: ['photo_1'],
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'invalid_client_email');
});

test('share unlock returns short-lived media urls after valid code', async () => {
  const response = await request(createTestApp())
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  assert.equal(response.status, 200);
  assert.ok(response.body.customerAccessToken);
  assert.match(response.body.photos[0].url, /access_token=/);
  assert.equal(response.body.photosPage.hasMore, false);
});

test('share unlock returns the first paginated photo batch', async () => {
  const initialPhotos = Array.from({ length: 45 }, (_, index) => ({
    id: `photo_${String(index + 1).padStart(2, '0')}`,
    shareToken: 'share_1',
    sizeBytes: 100,
    createdAt: new Date(Date.now() + index * 1000).toISOString(),
  }));
  const response = await request(createTestApp({ initialPhotos }))
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  assert.equal(response.status, 200);
  assert.equal(response.body.photos.length, 40);
  assert.equal(response.body.photosPage.hasMore, true);
  assert.equal(response.body.photosPage.totalCount, 45);
  assert.ok(response.body.photosPage.nextCursor);
});

test('unlocked share sessions load the next photo page', async () => {
  const initialPhotos = Array.from({ length: 45 }, (_, index) => ({
    id: `photo_${String(index + 1).padStart(2, '0')}`,
    shareToken: 'share_1',
    sizeBytes: 100,
    createdAt: new Date(Date.now() + index * 1000).toISOString(),
  }));
  const app = createTestApp({ initialPhotos });
  const unlock = await request(app)
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  const response = await request(app)
    .get('/api/share-session/share_1/photos')
    .query({ cursor: unlock.body.photosPage.nextCursor, limit: 40 })
    .set('Authorization', `Bearer ${unlock.body.customerAccessToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.photos.length, 5);
  assert.equal(response.body.photosPage.hasMore, false);
});

test('unlocked share photo pages reject invalid cursors', async () => {
  const app = createTestApp();
  const unlock = await request(app)
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  const response = await request(app)
    .get('/api/share-session/share_1/photos')
    .query({ cursor: 'cursor-invalido' })
    .set('Authorization', `Bearer ${unlock.body.customerAccessToken}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'invalid_photo_cursor');
});

test('unlocked share photo pages require customer access token', async () => {
  const response = await request(createTestApp())
    .get('/api/share-session/share_1/photos');

  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'media_access_denied');
});

test('unlocked share sessions can create Pix without admin bearer token', async () => {
  const app = createTestApp();
  const unlock = await request(app)
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  const response = await request(app)
    .post('/api/share-session/share_1/pix')
    .set('Authorization', `Bearer ${unlock.body.customerAccessToken}`)
    .send({ sessionId: 'guest_pix_1', photoIds: ['photo_1'] });

  assert.equal(response.status, 200);
  assert.equal(response.body.qr_code_base64, 'pix-base64');
  assert.equal(response.body.shareToken, 'share_1');

  const stored = await request(app)
    .get('/api/admin/session/guest_pix_1')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(stored.status, 200);
  assert.equal(stored.body.subtotal, 15);
  assert.equal(stored.body.discountAmount, 0);
  assert.equal(stored.body.amount, 15);
});

test('unlocked share sessions apply gallery discount below the package minimum', async () => {
  const app = createTestApp();
  await request(app)
    .patch('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret')
    .send({ packageType: 'escola', subtotal: 15, discountAmount: 5 });
  const unlock = await request(app)
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  const response = await request(app)
    .post('/api/share-session/share_1/pix')
    .set('Authorization', `Bearer ${unlock.body.customerAccessToken}`)
    .send({ sessionId: 'guest_pix_threshold_guard', photoIds: ['photo_1'] });

  assert.equal(response.status, 200);

  const stored = await request(app)
    .get('/api/admin/session/guest_pix_threshold_guard')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(stored.status, 200);
  assert.equal(stored.body.subtotal, 15);
  assert.equal(stored.body.discountAmount, 5);
  assert.equal(stored.body.amount, 10);
});

test('unlocked share sessions apply the gallery discount to Pix totals', async () => {
  const initialPhotos = Array.from({ length: 5 }, (_, index) => ({
    id: `photo_${index + 1}`,
    shareToken: 'share_1',
    sizeBytes: 100,
    createdAt: new Date(Date.now() + index * 1000).toISOString(),
  }));
  const app = createTestApp({ initialPhotos });
  await request(app)
    .patch('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret')
    .send({ packageType: 'eventos', count: 5, subtotal: 50, discountAmount: 5 });
  const unlock = await request(app)
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  const response = await request(app)
    .post('/api/share-session/share_1/pix')
    .set('Authorization', `Bearer ${unlock.body.customerAccessToken}`)
    .send({ sessionId: 'guest_pix_discount', photoIds: ['photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5'] });

  assert.equal(response.status, 200);

  const stored = await request(app)
    .get('/api/admin/session/guest_pix_discount')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(stored.status, 200);
  assert.equal(stored.body.subtotal, 50);
  assert.equal(stored.body.discountAmount, 5);
  assert.equal(stored.body.amount, 45);
});

test('unlocked share sessions apply the gallery discount to manual payment requests', async () => {
  const initialPhotos = Array.from({ length: 5 }, (_, index) => ({
    id: `photo_${index + 1}`,
    shareToken: 'share_1',
    sizeBytes: 100,
    createdAt: new Date(Date.now() + index * 1000).toISOString(),
  }));
  const app = createTestApp({ initialPhotos });
  await request(app)
    .patch('/api/admin/share-sessions/share_1')
    .set('Authorization', 'Bearer admin-secret')
    .send({ packageType: 'eventos', count: 5, subtotal: 50, discountAmount: 5 });
  const unlock = await request(app)
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  const response = await request(app)
    .post('/api/share-session/share_1/manual-payment')
    .set('Authorization', `Bearer ${unlock.body.customerAccessToken}`)
    .send({ sessionId: 'guest_manual_discount', photoIds: ['photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5'] });

  assert.equal(response.status, 200);

  const stored = await request(app)
    .get('/api/admin/session/guest_manual_discount')
    .set('Authorization', 'Bearer admin-secret');

  assert.equal(stored.status, 200);
  assert.equal(stored.body.subtotal, 50);
  assert.equal(stored.body.discountAmount, 5);
  assert.equal(stored.body.amount, 45);
  assert.equal(stored.body.status, 'pending');
});

test('unlocked share sessions reject Pix for photos outside the share', async () => {
  const app = createTestApp();
  const unlock = await request(app)
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  const response = await request(app)
    .post('/api/share-session/share_1/pix')
    .set('Authorization', `Bearer ${unlock.body.customerAccessToken}`)
    .send({ sessionId: 'guest_pix_2', photoIds: ['photo_elsewhere'] });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'photo_share_mismatch');
});
