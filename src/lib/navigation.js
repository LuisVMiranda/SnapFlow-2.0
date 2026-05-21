const ADMIN_SCREENS = new Set(['dashboard', 'gallery', 'summary', 'pix', 'manual-pending', 'confirmed']);

export function resolveInitialScreen({ savedScreen, savedShareAccess = null, shareToken = '' }) {
  if (shareToken) {
    if (savedShareAccess?.token === shareToken && savedShareAccess?.customerAccessToken) return 'gallery';
    return 'share-lock';
  }

  return ADMIN_SCREENS.has(savedScreen) ? savedScreen : 'dashboard';
}
