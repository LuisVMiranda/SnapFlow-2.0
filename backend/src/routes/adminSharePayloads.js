const { watermarkAssetPayload } = require('../services/watermarkAssetService');

function adminPhotoPayload(photo) {
  const versionQuery = photo.mediaVersion ? `?v=${encodeURIComponent(photo.mediaVersion)}` : '';
  return {
    id: photo.id,
    url: `/api/media/${photo.id}/preview${versionQuery}`,
    thumbUrl: `/api/media/${photo.id}/thumb${versionQuery}`,
    createdAt: photo.createdAt,
    sizeBytes: Number(photo.sizeBytes || 0),
    appliedPresetIds: photo.appliedPresetIds || [],
    presetAppliedAt: photo.presetAppliedAt || null,
    mediaVersion: photo.mediaVersion || '',
  };
}

function adminPhotoPagePayload(page) {
  return {
    ...page,
    loadedCount: page.loadedCount || 0,
    totalCount: Number(page.totalCount || 0),
  };
}

async function adminShareDetails(repos, token, options = {}) {
  const share = await repos.getShareSession(token, { includeAccessCode: true });
  if (!share) return null;
  const { items, page } = await repos.listPhotosForSharePage(share.token, options);
  const watermarkAsset = share.watermarkAssetId && typeof repos.getWatermarkAsset === 'function'
    ? await repos.getWatermarkAsset(share.watermarkAssetId)
    : null;
  return {
    ...share,
    watermarkAsset: watermarkAssetPayload(watermarkAsset),
    photoCount: page.totalCount,
    photos: items.map(adminPhotoPayload),
    photosPage: adminPhotoPagePayload(page),
  };
}

module.exports = { adminPhotoPagePayload, adminPhotoPayload, adminShareDetails };
