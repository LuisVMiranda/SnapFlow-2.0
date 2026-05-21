const assert = require('node:assert/strict');
const test = require('node:test');
const { rowToPhoto } = require('../src/repos/mappers');

test('rowToPhoto adds a media version to preview and thumbnail URLs', () => {
  const photo = rowToPhoto({
    id: 'photo_1',
    session_id: null,
    share_token: 'share_1',
    source_path: 'sources/photo_1.jpg',
    original_path: 'originals/photo_1.jpg',
    thumb_path: 'thumbs/photo_1.jpg',
    preview_path: 'previews/photo_1.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 123,
    checksum: 'checksum-after-preset',
    created_at: '2026-05-21T12:00:00.000Z',
    retention_expires_at: null,
    deleted_at: null,
    applied_preset_ids: ['exposicao-alta'],
    applied_preset_snapshot: [],
    preset_applied_at: '2026-05-21T14:00:00.000Z',
    undo_original_path: null,
    undo_thumb_path: null,
    undo_preview_path: null,
    undo_preset_snapshot: null,
  }, { publicBaseUrl: 'http://localhost:5173' });

  assert.equal(photo.sourcePath, 'sources/photo_1.jpg');
  assert.equal(photo.mediaVersion, '2026-05-21T14:00:00.000Z');
  assert.match(photo.url, /\/api\/media\/photo_1\/preview\?v=2026-05-21T14%3A00%3A00\.000Z$/);
  assert.match(photo.thumbUrl, /\/api\/media\/photo_1\/thumb\?v=2026-05-21T14%3A00%3A00\.000Z$/);
});
