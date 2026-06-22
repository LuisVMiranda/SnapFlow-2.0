const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeliveryReleaseService } = require('../src/services/deliveryReleaseService');

function makeRepos(deliveryMode) {
  const calls = [];
  const session = { id: 'sess_1', status: 'approved', shareToken: 'share_1' };
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
      return { token: shareToken, deliveryMode };
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
    deliveryQueue: { enqueue: async (sessionId) => enqueued.push(sessionId) },
  });

  await service.releaseApprovedSession({ id: 'sess_1', status: 'approved', shareToken: 'share_1' });

  assert.deepEqual(enqueued, ['sess_1']);
  assert.ok(repos.calls.some((call) => call[0] === 'entitlement'));
  assert.ok(repos.calls.some((call) => call[0] === 'status' && call[2] === 'queued'));
});

test('approved download-only gallery creates records without WhatsApp enqueue', async () => {
  const repos = makeRepos('download');
  const enqueued = [];
  const service = createDeliveryReleaseService({
    repos,
    deliveryQueue: { enqueue: async (sessionId) => enqueued.push(sessionId) },
  });

  await service.releaseApprovedSession({ id: 'sess_1', status: 'approved', shareToken: 'share_1' });

  assert.deepEqual(enqueued, []);
  assert.ok(repos.calls.some((call) => call[0] === 'entitlement'));
  assert.ok(repos.calls.some((call) => call[0] === 'status' && call[2] === 'download_available'));
});

test('approved both-channel gallery records purchase and enqueues WhatsApp', async () => {
  const repos = makeRepos('both');
  const enqueued = [];
  const service = createDeliveryReleaseService({
    repos,
    deliveryQueue: { enqueue: async (sessionId) => enqueued.push(sessionId) },
  });

  await service.releaseApprovedSession({ id: 'sess_1', status: 'approved', shareToken: 'share_1' });

  assert.deepEqual(enqueued, ['sess_1']);
  assert.ok(repos.calls.some((call) => call[0] === 'entitlement'));
  assert.ok(repos.calls.some((call) => call[0] === 'status' && call[2] === 'queued'));
});
