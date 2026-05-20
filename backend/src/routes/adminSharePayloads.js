function adminPhotoPayload(photo) {
  return {
    id: photo.id,
    url: `/api/media/${photo.id}/preview`,
    thumbUrl: `/api/media/${photo.id}/thumb`,
    createdAt: photo.createdAt,
    sizeBytes: Number(photo.sizeBytes || 0),
    appliedPresetIds: photo.appliedPresetIds || [],
    presetAppliedAt: photo.presetAppliedAt || null,
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
  return {
    ...share,
    photoCount: page.totalCount,
    photos: items.map(adminPhotoPayload),
    photosPage: adminPhotoPagePayload(page),
  };
}

module.exports = { adminPhotoPagePayload, adminPhotoPayload, adminShareDetails };
