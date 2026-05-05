const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const request = require('supertest');
const { createApp } = require('../src/app');
const { hashValue } = require('../src/tokens');

function createTestApp({
  deliveryQueue = { enqueue: async () => null },
  whatsapp = {
    getStatus: () => ({ ready: true, status: 'ready', lastError: null }),
    reconnect: async () => ({ ready: true, status: 'ready', lastError: null }),
    resetAuth: async () => ({ ready: false, status: 'initializing', lastError: null }),
    sendText: async () => {},
  },
} = {}) {
  let share = {
    token: 'share_1',
    galleryId: 'gallery_1',
    accessCodeHash: hashValue('1234'),
    accessCode: '1234',
    packageType: 'eventos',
    phone: '11999999999',
    clientName: 'Ana Cliente',
    photoCount: 1,
    total: 10,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    revokedAt: null,
    status: 'active',
    link: 'http://localhost:5173/s/share_1',
  };
  let deletedShareToken = null;
  let recreatedShare = null;
  const sessions = new Map();
  let photos = [{ id: 'photo_1', shareToken: 'share_1', sizeBytes: 100 }];
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
      recent: [],
      shareRecent: deletedShareToken ? [] : [{
        token: 'share_1',
        photoCount: 1,
        status: 'active',
        accessCode: share.accessCode,
        clientName: share.clientName,
      }],
    }),
    getShareSession: async (token, options = {}) => {
      const target = token === 'share_1' ? share : recreatedShare?.token === token ? recreatedShare : null;
      if (!target || deletedShareToken === token) return null;
      return options.includeSensitive ? target : { ...target, accessCodeHash: undefined };
    },
    markShareAccessGranted: async () => share,
    listPhotosForShare: async (token) => photos.filter((photo) => photo.shareToken === token && !photo.deletedAt),
    getPhoto: async (photoId) => photos.find((photo) => photo.id === photoId && !photo.deletedAt) || null,
    createPhotos: async (payload) => {
      photos = [...photos, ...payload];
      return payload;
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
        photoCount: payload.photoCount,
        total: payload.total,
        createdAt: new Date().toISOString(),
        expiresAt: payload.expiresAt.toISOString(),
        revokedAt: null,
        status: 'active',
        link: payload.link,
      };
      return recreatedShare;
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
        packageType: updates.packageType || share.packageType,
        total: updates.total === undefined ? share.total : updates.total,
        expiresAt: updates.expiresAt ? updates.expiresAt.toISOString() : share.expiresAt,
        accessCode: updates.accessCode || share.accessCode,
        accessCodeHash: updates.accessCodeHash || share.accessCodeHash,
        revokedAt: updates.expiresAt ? null : share.revokedAt,
        status: updates.expiresAt ? 'active' : share.status,
      };
      return share;
    },
    createSession: async (session) => {
      const stored = {
        id: session.id,
        amount: session.amount,
        photoCount: session.photoCount,
        packageType: session.packageType,
        phone: session.phone,
        clientName: session.clientName || '',
        status: session.status,
        paymentMethod: session.paymentMethod,
        deliveryStatus: session.deliveryStatus,
      };
      sessions.set(stored.id, stored);
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
      session.status = 'approved';
      session.deliveryStatus = 'queued';
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
    createPixPayment: async (payload) => ({
      qr_code: 'pix-code',
      qr_code_base64: 'pix-base64',
      payment_id: 'payment_1',
      sessionId: payload.sessionId,
      shareToken: payload.shareToken,
      total: payload.total,
    }),
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

  const stillLocked = await request(app)
    .get('/api/admin/access')
    .set('Authorization', 'Bearer admin-secret');
  assert.equal(stillLocked.status, 429);
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
      packageType: 'eventos',
      count: 1,
      total: 10,
      expiresMinutes: 30,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.whatsappSent, true);
  assert.equal(response.body.whatsappStatus, 'sent');
  assert.equal(response.body.clientName, 'Ana Cliente');
  assert.equal(sends.length, 1);
  assert.equal(sends[0].phone, '5511999999999');
  assert.match(sends[0].message, /Ana Cliente/);
  assert.match(sends[0].message, /Código/);
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
  assert.equal(response.body.photos.length, 1);
  assert.equal(response.body.photos[0].id, 'photo_1');
  assert.match(response.body.photos[0].thumbUrl, /\/api\/media\/photo_1\/thumb/);
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
      phone: '11888888888',
      clientName: 'Bruna Cliente',
      packageType: 'escola',
      total: 42,
      accessCode: 'ab12',
      expiresMinutes: 20,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.phone, '11888888888');
  assert.equal(response.body.clientName, 'Bruna Cliente');
  assert.equal(response.body.packageType, 'escola');
  assert.equal(response.body.total, 42);
  assert.equal(response.body.accessCode, 'AB12');
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
  assert.equal(response.body.photos, undefined);
  assert.equal(response.body.thumbUrls, undefined);
});

test('share unlock returns short-lived media urls after valid code', async () => {
  const response = await request(createTestApp())
    .post('/api/share-session/share_1/unlock')
    .send({ code: '1234' });

  assert.equal(response.status, 200);
  assert.ok(response.body.customerAccessToken);
  assert.match(response.body.photos[0].url, /access_token=/);
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
