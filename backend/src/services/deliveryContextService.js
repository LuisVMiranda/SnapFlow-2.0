function shareTokenForDelivery(session, photos = []) {
  if (session?.shareToken) return session.shareToken;
  const photoTokens = new Set(photos.map((photo) => photo.shareToken).filter(Boolean));
  return photoTokens.size === 1 ? Array.from(photoTokens)[0] : '';
}

function activeDeliveryOverlay(effectiveOverlay) {
  if (!effectiveOverlay?.enabled || effectiveOverlay.kind !== 'image' || !effectiveOverlay.assetPath) return null;
  return effectiveOverlay;
}

async function deliveryContextForShareToken({ galleryOverlays, shareToken }) {
  if (!shareToken || typeof galleryOverlays?.effectiveForShare !== 'function') {
    return { overlay: null, storyDeliveryEnabled: false };
  }
  const effectiveOverlay = await galleryOverlays.effectiveForShare(shareToken);
  return {
    overlay: activeDeliveryOverlay(effectiveOverlay),
    storyDeliveryEnabled: effectiveOverlay?.share?.storyDeliveryEnabled === true,
  };
}

module.exports = {
  activeDeliveryOverlay,
  deliveryContextForShareToken,
  shareTokenForDelivery,
};
