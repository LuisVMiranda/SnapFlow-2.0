const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { createShareSessionRepo } = require('../src/repos/shareSessions');

function createRepoWithQuery(query) {
  return createShareSessionRepo({
    attachPhotosToSession: async () => {},
    cancelPendingSessionsForShare: async () => {},
    query,
  });
}

test('share cart lookup returns an empty cart when no cart row exists yet', async () => {
  const repo = createRepoWithQuery(async (sql, params) => {
    assert.match(sql, /select photo_ids from share_carts/i);
    assert.deepEqual(params, ['share_1']);
    return { rows: [] };
  });

  assert.deepEqual(await repo.getShareCart('share_1'), []);
});

test('share cart lookup sanitizes saved photo ids', async () => {
  const repo = createRepoWithQuery(async () => ({
    rows: [{ photo_ids: ['photo_1', '', null, 123] }],
  }));

  assert.deepEqual(await repo.getShareCart('share_1'), ['photo_1', '123']);
});

test('share cart save remains safe if the database returns no row', async () => {
  const repo = createRepoWithQuery(async () => ({ rows: [] }));

  assert.deepEqual(await repo.saveShareCart('share_1', ['photo_1']), []);
});

test('share cart lookup normalizes arbitrary stored values without crashing', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.oneof(
        fc.string({ maxLength: 20 }),
        fc.integer(),
        fc.constant(null),
        fc.constant(undefined)
      ), { maxLength: 30 }),
      async (storedValues) => {
        const repo = createRepoWithQuery(async () => ({
          rows: [{ photo_ids: storedValues }],
        }));

        const actual = await repo.getShareCart('share_1');
        const expected = storedValues
          .filter((photoId) => photoId !== null && photoId !== undefined)
          .map(String)
          .filter(Boolean);
        assert.deepEqual(actual, expected);
      }
    )
  );
});
