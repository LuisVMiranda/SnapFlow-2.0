const ADMIN_SCREENS = new Set(['dashboard', 'gallery', 'summary', 'pix', 'manual-pending', 'confirmed']);
const SHARE_UNLOCKED_SCREENS = new Set(['gallery', 'summary', 'pix', 'manual-pending', 'confirmed']);

export function resolveInitialScreen({ savedScreen, savedShareAccess = null, shareToken = '' }) {
  if (shareToken) {
    if (savedShareAccess?.token === shareToken) {
      return SHARE_UNLOCKED_SCREENS.has(savedScreen) ? savedScreen : 'gallery';
    }
    return 'share-lock';
  }

  return ADMIN_SCREENS.has(savedScreen) ? savedScreen : 'dashboard';
}
