const assert = require('node:assert/strict');
const test = require('node:test');
const { createGalleryAccessService, postPaymentExpiry } = require('../src/services/galleryAccessService');

test('post-payment expiry defaults to seven days and honors gallery overrides', () => {
  const approvedAt = '2026-07-14T12:00:00.000Z';

  assert.equal(postPaymentExpiry(approvedAt).toISOString(), '2026-07-21T12:00:00.000Z');
  assert.equal(postPaymentExpiry(approvedAt, 30).toISOString(), '2026-08-13T12:00:00.000Z');
  assert.equal(postPaymentExpiry('invalid', 7), null);
});

test('promotion uses approvedAt idempotently and a later purchase advances the target', async () => {
  const targets = [];
  const repos = {
    async getShareSession(token) {
      return { token, postPaymentAccessDays: 7 };
    },
    async promoteShareAfterPayment(token, expiresAt) {
      targets.push([token, expiresAt.toISOString()]);
      return { token, expiresAt };
    },
  };
  const service = createGalleryAccessService({ repos });
  const first = { shareToken: 'share_1', approvedAt: '2026-07-14T12:00:00.000Z' };

  await service.promoteAfterPayment(first);
  await service.promoteAfterPayment(first);
  await service.promoteAfterPayment({ ...first, approvedAt: '2026-07-18T12:00:00.000Z' });

  assert.deepEqual(targets, [
    ['share_1', '2026-07-21T12:00:00.000Z'],
    ['share_1', '2026-07-21T12:00:00.000Z'],
    ['share_1', '2026-07-25T12:00:00.000Z'],
  ]);
});

test('explicitly revoked galleries are never promoted automatically', async () => {
  let promotionCount = 0;
  const revoked = { token: 'share_1', revokedAt: '2026-07-14T11:00:00.000Z' };
  const service = createGalleryAccessService({
    repos: {
      async getShareSession() {
        return revoked;
      },
      async promoteShareAfterPayment() {
        promotionCount += 1;
      },
    },
  });

  assert.equal(await service.promoteAfterPayment({ shareToken: 'share_1', approvedAt: new Date() }), revoked);
  assert.equal(promotionCount, 0);
});

test('revoked status blocks promotion even when revokedAt is missing', async () => {
  let promotionCount = 0;
  const revoked = { token: 'share_1', revokedAt: null, status: 'revoked' };
  const service = createGalleryAccessService({
    repos: {
      async getShareSession() {
        return revoked;
      },
      async promoteShareAfterPayment() {
        promotionCount += 1;
      },
    },
  });

  assert.equal(await service.promoteAfterPayment({ shareToken: 'share_1', approvedAt: new Date() }), revoked);
  assert.equal(promotionCount, 0);
});
