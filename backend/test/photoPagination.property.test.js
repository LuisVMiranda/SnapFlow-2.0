const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const {
  buildPhotoPage,
  decodePhotoCursor,
  encodePhotoCursor,
  normalizePhotoPageLimit,
} = require('../src/services/photoPagination');

test('normalizePhotoPageLimit always clamps to the supported range', () => {
  fc.assert(
    fc.property(
      fc.oneof(fc.integer(), fc.double({ noNaN: true }), fc.string(), fc.constant(null), fc.constant(undefined)),
      (value) => {
        const limit = normalizePhotoPageLimit(value);
        assert.equal(Number.isInteger(limit), true);
        assert.equal(limit >= 1, true);
        assert.equal(limit <= 80, true);
      }
    )
  );
});

test('photo cursors preserve createdAt and id', () => {
  fc.assert(
    fc.property(
      fc.record({
        createdAtMs: fc.integer({ min: 0, max: 4_102_444_800_000 }),
        id: fc.string({ minLength: 1, maxLength: 40 }).filter((value) => value.trim().length > 0),
      }),
      ({ createdAtMs, id }) => {
        const createdAt = new Date(createdAtMs).toISOString();
        const decoded = decodePhotoCursor(encodePhotoCursor({ createdAt, id }));
        assert.deepEqual(decoded, { createdAt, id });
      }
    )
  );
});

test('invalid photo cursors fail with a controlled application error', () => {
  fc.assert(
    fc.property(fc.string(), (cursor) => {
      try {
        const decoded = decodePhotoCursor(cursor);
        if (decoded === null) {
          assert.equal(cursor, '');
          return;
        }
        assert.equal(typeof decoded.createdAt, 'string');
        assert.equal(typeof decoded.id, 'string');
      } catch (error) {
        assert.equal(error.code, 'invalid_photo_cursor');
        assert.equal(error.status, 400);
      }
    })
  );
});

test('cursor pagination does not skip, duplicate, or leak photos', () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }).filter((value) => value.trim().length > 0),
          shareToken: fc.constantFrom('target', 'other'),
          createdAtMs: fc.integer({ min: 0, max: 100_000_000 }),
          deletedAt: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        }),
        { selector: (photo) => photo.id, maxLength: 80 }
      ),
      fc.integer({ min: 1, max: 20 }),
      (photos, limit) => {
        const visible = photos
          .filter((photo) => photo.shareToken === 'target' && !photo.deletedAt)
          .map((photo) => ({
            id: photo.id,
            createdAt: new Date(photo.createdAtMs).toISOString(),
            shareToken: photo.shareToken,
          }))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

        const collected = [];
        let cursor = null;

        do {
          const pageRows = (cursor
            ? visible.filter((photo) => photo.createdAt > cursor.createdAt || (photo.createdAt === cursor.createdAt && photo.id > cursor.id))
            : visible
          ).slice(0, limit + 1);
          const { items, page } = buildPhotoPage(pageRows, limit, visible.length);
          collected.push(...items.map((photo) => photo.id));
          cursor = page.nextCursor ? decodePhotoCursor(page.nextCursor) : null;
          if (!page.hasMore) break;
        } while (cursor);

        assert.deepEqual(collected, visible.map((photo) => photo.id));
        assert.equal(new Set(collected).size, collected.length);
      }
    )
  );
});
