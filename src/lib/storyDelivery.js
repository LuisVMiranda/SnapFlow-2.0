import { hasExplicitOverlayPlacement } from '../hooks/useOverlaySettings';

export const STORY_DELIVERY_SETUP_MESSAGE = 'Configure primeiro o overlay para Stories. Vá em Configurações > Overlays de galeria, abra o overlay usado nesta galeria e ajuste a prévia 9:16 de Stories. Depois volte para esta galeria e ative a entrega em formato Stories.';

export function overlayAssetHasStoryProfile(asset) {
  return Boolean(asset?.storyConfigured || hasExplicitOverlayPlacement(asset?.storySettings));
}
