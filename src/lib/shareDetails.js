export function normalizeShareDetails(data = {}, withAdminMediaToken = (url) => url) {
  const normalizeAsset = (asset) => asset ? {
    ...asset,
    url: asset.url ? withAdminMediaToken(asset.url) : '',
  } : null;
  return {
    ...data,
    overlayAsset: normalizeAsset(data.overlayAsset),
    watermarkAsset: normalizeAsset(data.watermarkAsset),
    photosPage: data.photosPage || { hasMore: false, nextCursor: null, loadedCount: 0, totalCount: data.photoCount || 0 },
    photos: Array.isArray(data.photos)
      ? data.photos.map((photo) => ({
          ...photo,
          url: withAdminMediaToken(photo.url),
          thumbUrl: withAdminMediaToken(photo.thumbUrl || photo.url),
        }))
      : [],
  };
}

export function mergeDetailPhotos(currentPhotos = [], nextPhotos = []) {
  const seen = new Set();
  return [...currentPhotos, ...nextPhotos].filter((photo) => {
    if (!photo.id || seen.has(photo.id)) return false;
    seen.add(photo.id);
    return true;
  });
}
