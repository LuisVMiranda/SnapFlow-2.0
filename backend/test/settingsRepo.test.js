const assert = require('node:assert/strict');
const test = require('node:test');
const { createSettingsRepo } = require('../src/repos/settings');

test('retention cleanup excludes files from an active gallery with extended access', async () => {
  let statement = '';
  let values = [];
  const repo = createSettingsRepo({
    config: {},
    pool: {},
    query: async (sql, params) => {
      statement = sql;
      values = params;
      return { rows: [] };
    },
    withTransaction: async () => {},
  });
  const now = new Date('2026-07-14T12:00:00.000Z');

  await repo.listCleanupEligible(now);

  assert.match(statement, /not exists[\s\S]*share_sessions ss/i);
  assert.match(statement, /ss\.revoked_at is null/i);
  assert.match(statement, /ss\.expires_at > now\(\)/i);
  assert.deepEqual(values, [now]);
});
