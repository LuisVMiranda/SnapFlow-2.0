const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeliveryReleaseService } = require('../src/services/deliveryReleaseService');

function makeRepos(deliveryMode) {
  const calls = [];
  const session = { id: 'sess_1', status: 'approved', shareToken: 'share_1', phone: '+55 11 99999-9999' };
  return {
    calls,
    async createDownloadEntitlementsForSession(sessionId, shareToken) {
      calls.push(['entitlement', sessionId, shareToken]);
    },
    async getSession(sessionId) {
      calls.push(['getSession', sessionId]);
      return { ...session, deliveryStatus: calls.findLast((call) => call[0] === 'status')?.[2] || 'idle' };
    },
    async getShareSession(shareToken) {
      calls.push(['getShare', shareToken]);
      return { token: shareToken, deliveryMode, phone: session.phone };
    },
    async updateDeliveryStatus(sessionId, status) {
      calls.push(['status', sessionId, status]);
    },
  };
}

test('approved WhatsApp gallery creates purchase records and enqueues WhatsApp', async () => {
  const repos = makeRepos('whatsapp');
  const enqueued = [];
  const service = createDeliveryReleaseService({
    repos,
    deliveryQueue: { enqueue: async (sessionId, kind) => enqueued.push([sessionId, kind]) },
  });

  await service.releaseApprovedSession({ id: 'sess_1', status: 'approved', shareToken: 'share_1', phone: '+55 11 99999-9999' });

  assert.deepEqual(enqueued, [
    ['sess_1', 'approval_notification'],
    ['sess_1', 'media'],
  ]);
  assert.ok(repos.calls.some((call) => call[0] === 'entitlement'));
  assert.ok(repos.calls.some((call) => call[0] === 'status' && call[2] === 'queued'));
});

test('approved download-only gallery creates records without WhatsApp enqueue', async () => {
  const repos = makeRepos('download');
  const enqueued = [];
  const service = createDeliveryReleaseService({
    repos,
    deliveryQueue: { enqueue: async (sessionId, kind) => enqueued.push([sessionId, kind]) },
  });

  await service.releaseApprovedSession({ id: 'sess_1', status: 'approved', shareToken: 'share_1', phone: '+55 11 99999-9999' });

  assert.deepEqual(enqueued, [['sess_1', 'approval_notification']]);
  assert.ok(repos.calls.some((call) => call[0] === 'entitlement'));
  assert.ok(repos.calls.some((call) => call[0] === 'status' && call[2] === 'download_available'));
});

test('approved both-channel gallery records purchase and enqueues WhatsApp', async () => {
  const repos = makeRepos('both');
  const enqueued = [];
  const service = createDeliveryReleaseService({
    repos,
    deliveryQueue: { enqueue: async (sessionId, kind) => enqueued.push([sessionId, kind]) },
  });

  await service.releaseApprovedSession({ id: 'sess_1', status: 'approved', shareToken: 'share_1', phone: '+55 11 99999-9999' });

  assert.deepEqual(enqueued, [
    ['sess_1', 'approval_notification'],
    ['sess_1', 'media'],
  ]);
  assert.ok(repos.calls.some((call) => call[0] === 'entitlement'));
  assert.ok(repos.calls.some((call) => call[0] === 'status' && call[2] === 'queued'));
});

test('revoked gallery status keeps entitlements but does not enqueue a link notification', async () => {
  const repos = makeRepos('download');
  const enqueued = [];
  const service = createDeliveryReleaseService({
    repos,
    galleryAccess: { promoteAfterPayment: async () => ({ revokedAt: null, status: 'revoked', phone: '+55 11 99999-9999' }) },
    deliveryQueue: { enqueue: async (sessionId, kind) => enqueued.push([sessionId, kind]) },
  });

  await service.releaseApprovedSession({
    id: 'sess_1',
    status: 'approved',
    shareToken: 'share_1',
    phone: '+55 11 99999-9999',
    approvedAt: new Date(),
  });

  assert.deepEqual(enqueued, []);
  assert.ok(repos.calls.some((call) => call[0] === 'entitlement'));
});

test('media enqueue failure does not reject an approved sale', async () => {
  const repos = makeRepos('both');
  const service = createDeliveryReleaseService({
    repos,
    deliveryQueue: {
      async enqueue(sessionId, kind) {
        if (kind === 'media') throw new Error('fila indisponível');
        return { sessionId, kind };
      },
    },
  });

  const result = await service.releaseApprovedSession({
    id: 'sess_1',
    status: 'approved',
    shareToken: 'share_1',
    phone: '+55 11 99999-9999',
  });

  assert.equal(result.status, 'approved');
  assert.ok(repos.calls.some((call) => call[0] === 'status' && call[2] === 'failed'));
});
