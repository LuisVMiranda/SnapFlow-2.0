const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { validateOrder, validateTypes, searchOptions, galleryPayload, safeHttpUrl, createWebsiteService } = require('../src/services/websiteService');

test('website inputs reject duplicates, invalid types, invalid pages and unsafe URLs', () => {
  assert.throws(() => validateOrder(['a', 'a']));
  assert.throws(() => validateOrder(Array(11).fill('a')));
  assert.throws(() => validateTypes([], {}));
  assert.throws(() => validateTypes(['unknown'], { eventos: {} }));
  assert.deepEqual(validateTypes(['eventos', 'eventos'], { eventos: {} }), ['eventos']);
  for (const cursor of ['-1', 'NaN', '0.5', 'Infinity']) assert.throws(() => searchOptions({ cursor }, []));
  assert.equal(safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpUrl('https://user:secret@example.test'), '');
  assert.equal(safeHttpUrl('https://gallery.test/path'), 'https://gallery.test');
});

test('website public payload uses configured base and excludes private gallery fields', async () => {
  const row = { gallery_id: 'stable', token: 'token', gallery_name: '<img onerror=alert(1)>', version: 'v1',
    phone: 'private', access_code: 'SECRET', client_email: 'private@example.test', link: 'http://localhost/old' };
  const payload = galleryPayload(row, 'https://current.test:8443');
  assert.equal(payload.galleryUrl, 'https://current.test:8443/s/token');
  assert.deepEqual(Object.keys(payload).sort(), ['coverUrl', 'galleryUrl', 'id', 'title', 'token']);
  const service = createWebsiteService({ config: { publicWebsiteUrl: 'https://site.test', publicBaseUrl: 'http://localhost' },
    credentials: { getSecretValue: async (key) => key === 'photographerPhone' ? '+55 82999999999' : 'https://current.test:8443' },
    repos: { getSettings: async () => ({}), websiteCarousel: async () => [row] }, packages: {} });
  const result = await service.get();
  assert.equal(result.contact.phone, '5582999999999');
  assert.deepEqual(Object.keys(result).sort(), ['contact', 'galleries']);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('deterministic randomized order validation preserves unique token sequences', () => {
  fc.assert(fc.property(fc.uniqueArray(fc.string({ minLength: 1 }), { maxLength: 10 }), (tokens) => {
    assert.deepEqual(validateOrder(tokens), tokens);
    if (tokens.length) assert.throws(() => validateOrder([...tokens, tokens[0]]));
  }), { seed: 7351023 });
});
