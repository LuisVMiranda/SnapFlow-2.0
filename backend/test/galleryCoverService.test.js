const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createGalleryCoverService, coverUrl } = require('../src/services/galleryCoverService');

test('cover cleanup logs filesystem failures without undoing a saved deletion', async (t) => {
  const warnings = [];
  t.mock.method(fs, 'unlink', async () => { throw Object.assign(new Error('locked'), { code: 'EACCES' }); });
  t.mock.method(console, 'warn', (message) => warnings.push(message));
  const service = createGalleryCoverService({ config: { storageRoot: os.tmpdir() }, repos: {
    removeGalleryCover: async () => ({ card_path: 'gallery-covers/card.webp', access_path: 'gallery-covers/access.webp' }),
  } });
  await service.remove('token');
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every((message) => message.includes('órfã pendente')));
});

test('cover cleanup refuses paths outside dedicated storage', async () => {
  const service = createGalleryCoverService({ config: { storageRoot: os.tmpdir() }, repos: {
    removeGalleryCover: async () => ({ card_path: path.join('..', 'unrelated.webp'), access_path: 'gallery-covers/access.webp' }),
  } });
  await assert.rejects(service.remove('token'), /Caminho de capa inválido/);
  assert.equal(coverUrl('a/b', 'v&1'), '/api/website/gallery-covers/a%2Fb/access?v=v%261');
});
