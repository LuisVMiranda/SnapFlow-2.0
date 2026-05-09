const { HttpError } = require('../errors');

const DEFAULT_PHOTO_PAGE_LIMIT = 40;
const MIN_PHOTO_PAGE_LIMIT = 1;
const MAX_PHOTO_PAGE_LIMIT = 80;

function normalizePhotoPageLimit(input) {
  const parsed = Math.trunc(Number(input));
  if (!Number.isFinite(parsed)) return DEFAULT_PHOTO_PAGE_LIMIT;
  return Math.min(MAX_PHOTO_PAGE_LIMIT, Math.max(MIN_PHOTO_PAGE_LIMIT, parsed));
}

function normalizeCursorPayload(payload) {
  const createdAt = payload?.createdAt || payload?.[0];
  const id = payload?.id || payload?.[1];
  const date = new Date(createdAt);
  if (!createdAt || Number.isNaN(date.getTime()) || !String(id || '').trim()) {
    throw new Error('invalid cursor payload');
  }
  return { createdAt: date.toISOString(), id: String(id) };
}

function encodePhotoCursor(photo) {
  const payload = normalizeCursorPayload(photo);
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePhotoCursor(cursor) {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(String(cursor), 'base64url').toString('utf8');
    return normalizeCursorPayload(JSON.parse(raw));
  } catch {
    throw new HttpError(
      400,
      'A página de fotos solicitada é inválida. Atualize a galeria e tente novamente.',
      'invalid_photo_cursor'
    );
  }
}

function buildPhotoPage(rows, limit, totalCount) {
  const safeLimit = normalizePhotoPageLimit(limit);
  const items = rows.slice(0, safeLimit);
  const hasMore = rows.length > safeLimit;
  const last = items[items.length - 1];
  return {
    items,
    page: {
      limit: safeLimit,
      hasMore,
      nextCursor: hasMore && last ? encodePhotoCursor(last) : null,
      loadedCount: items.length,
      totalCount: Number(totalCount || 0),
    },
  };
}

module.exports = {
  DEFAULT_PHOTO_PAGE_LIMIT,
  MAX_PHOTO_PAGE_LIMIT,
  MIN_PHOTO_PAGE_LIMIT,
  buildPhotoPage,
  decodePhotoCursor,
  encodePhotoCursor,
  normalizePhotoPageLimit,
};
