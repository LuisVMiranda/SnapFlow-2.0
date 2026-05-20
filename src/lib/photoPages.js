export const EMPTY_PHOTOS_PAGE = {
  limit: 40,
  hasMore: false,
  nextCursor: null,
  loadedCount: 0,
  totalCount: 0,
};

export function normalizePhotosPage(page = {}, fallback = {}) {
  const limit = Number(page.limit || fallback.limit || EMPTY_PHOTOS_PAGE.limit);
  const totalCount = Number(page.totalCount ?? fallback.totalCount ?? 0);
  const loadedCount = Number(page.loadedCount ?? fallback.loadedCount ?? 0);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : EMPTY_PHOTOS_PAGE.limit,
    hasMore: Boolean(page.hasMore),
    nextCursor: page.nextCursor || null,
    loadedCount: Number.isFinite(loadedCount) && loadedCount > 0 ? loadedCount : 0,
    totalCount: Number.isFinite(totalCount) && totalCount > 0 ? totalCount : 0,
  };
}

export function mergePhotoPages(existing = [], incoming = []) {
  const merged = [];
  const seen = new Set();

  for (const photo of [...existing, ...incoming]) {
    if (!photo.id || seen.has(photo.id)) continue;
    seen.add(photo.id);
    merged.push(photo);
  }

  return merged;
}

export function derivePhotoPageCounts({ photos = [], selected = [], photosPage = EMPTY_PHOTOS_PAGE }) {
  const loadedIds = new Set(photos.map((photo) => photo.id));
  const selectedLoadedCount = selected.filter((photoId) => loadedIds.has(photoId)).length;
  const totalCount = Math.max(Number(photosPage.totalCount || 0), photos.length);
  return {
    loadedCount: photos.length,
    selectedCount: selected.length,
    selectedLoadedCount,
    totalCount,
  };
}

export function persistedShareStateIncludesPhotos(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value.photos)) return true;
  return Object.values(value).some((item) => item && typeof item === 'object' && Array.isArray(item.photos));
}
