import { hasExplicitOverlayPlacement } from '../hooks/useOverlaySettings';

export function overlayAssetHasStoryProfile(asset) {
  return Boolean(asset?.storyConfigured || hasExplicitOverlayPlacement(asset?.storySettings));
}
