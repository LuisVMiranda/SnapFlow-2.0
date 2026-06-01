const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionRepo } = require('../src/repos/sessions');

test('direct sale gallery repair links detached sale photos to a manageable share', async () => {
  const calls = [];
  const client = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (/from sessions s/i.test(sql)) {
        return {
          rows: [{
            id: 'manual_1',
            amount_cents: 1000,
            subtotal_cents: 1000,
            discount_cents: 0,
            photo_count: 1,
            package_type: 'eventos',
            phone: '11999999999',
            client_name: 'Ana Cliente',
            client_email: '',
          }],
        };
      }
      if (/returning id/i.test(sql)) return { rowCount: 1, rows: [{ id: 'photo_1' }] };
      return { rowCount: 1, rows: [] };
    },
  };
  const repo = createSessionRepo({
    pool: {},
    query: async () => ({ rows: [] }),
    withTransaction: async (pool, fn) => fn(client),
  });
  const startedAt = Date.now();

  const repaired = await repo.ensureDirectSaleGalleries({
    defaultGalleryRetentionDays: 30,
    publicBaseUrl: 'http://localhost:5173',
  });

  assert.equal(repaired.length, 1);
  assert.equal(repaired[0].sessionId, 'manual_1');
  assert.equal(repaired[0].photoCount, 1);
  assert.match(calls[1].sql, /insert into share_sessions/i);
  assert.equal(calls[1].params[1], 'Venda - Ana Cliente');
  assert.equal(calls[1].params[3].length, 4);
  const expiresDeltaMinutes = Math.round((new Date(calls[1].params[12]).getTime() - startedAt) / 60_000);
  assert.equal(expiresDeltaMinutes, 30);
  assert.ok(new Date(calls[1].params[13]).getTime() - startedAt > 20 * 24 * 60 * 60 * 1000);
  assert.match(calls[1].params[14], /^http:\/\/localhost:5173\/s\//);
  assert.match(calls[2].sql, /update photos/i);
  assert.equal(calls[4].params[0], 'manual_1');
  assert.equal(calls[4].params[1], repaired[0].shareToken);
});
