const DEFAULT_OVERLAY_PLACEMENT = Object.freeze({
  x: 0.5,
  y: 0.5,
  widthRatio: 0.35,
  opacity: 0.75,
});

const OVERLAY_ORIENTATIONS = Object.freeze(['portrait', 'landscape']);

const DEFAULT_OVERLAY_SETTINGS = Object.freeze({
  ...DEFAULT_OVERLAY_PLACEMENT,
  portrait: DEFAULT_OVERLAY_PLACEMENT,
  landscape: DEFAULT_OVERLAY_PLACEMENT,
});

const STORY_OVERLAY_DIMENSIONS = Object.freeze({
  width: 1080,
  height: 1920,
});

function storyOverlayAspect(asset = {}) {
  const naturalWidth = Math.max(1, Number(asset?.width || 1));
  const naturalHeight = Math.max(1, Number(asset?.height || 1));
  return naturalHeight / naturalWidth;
}

function constrainStoryOverlayPlacement(placement, asset = {}) {
  const aspect = storyOverlayAspect(asset);
  const maxPixelWidth = Math.max(1, Math.min(
    STORY_OVERLAY_DIMENSIONS.width,
    Math.floor(STORY_OVERLAY_DIMENSIONS.height / aspect)
  ));
  const requestedPixelWidth = Math.round(STORY_OVERLAY_DIMENSIONS.width * placement.widthRatio);
  const overlayWidth = Math.max(1, Math.min(requestedPixelWidth, maxPixelWidth));
  const overlayHeight = Math.max(1, Math.round(overlayWidth * aspect));
  const halfWidth = overlayWidth / (STORY_OVERLAY_DIMENSIONS.width * 2);
  const halfHeight = overlayHeight / (STORY_OVERLAY_DIMENSIONS.height * 2);

  return {
    ...placement,
    x: Number(clampNumber(placement.x, DEFAULT_OVERLAY_PLACEMENT.x, halfWidth, 1 - halfWidth).toFixed(4)),
    y: Number(clampNumber(placement.y, DEFAULT_OVERLAY_PLACEMENT.y, halfHeight, 1 - halfHeight).toFixed(4)),
    widthRatio: Number((overlayWidth / STORY_OVERLAY_DIMENSIONS.width).toFixed(4)),
  };
}

function parseOverlaySettings(value = {}) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeOverlayPlacement(value = {}, fallback = DEFAULT_OVERLAY_PLACEMENT) {
  const source = parseOverlaySettings(value);
  return {
    x: Number(clampNumber(source.x, fallback.x, 0, 1).toFixed(4)),
    y: Number(clampNumber(source.y, fallback.y, 0, 1).toFixed(4)),
    widthRatio: Number(clampNumber(source.widthRatio, fallback.widthRatio, 0.05, 1.5).toFixed(4)),
    opacity: Number(clampNumber(source.opacity, fallback.opacity, 0.05, 1).toFixed(2)),
  };
}

function hasExplicitOverlayPlacement(value = {}) {
  const source = parseOverlaySettings(value);
  return ['x', 'y', 'widthRatio', 'opacity'].some((field) => (
    source?.[field] !== undefined && source?.[field] !== null
  ));
}

function normalizeOverlaySettings(value = {}) {
  const source = parseOverlaySettings(value);
  const base = normalizeOverlayPlacement(source);
  return {
    ...base,
    portrait: normalizeOverlayPlacement(source.portrait || source.vertical || {}, base),
    landscape: normalizeOverlayPlacement(source.landscape || source.horizontal || {}, base),
  };
}

function hasExplicitOverlaySettings(value = {}) {
  const source = parseOverlaySettings(value);
  return hasExplicitOverlayPlacement(source)
    || OVERLAY_ORIENTATIONS.some((orientation) => hasExplicitOverlayPlacement(source[orientation]))
    || hasExplicitOverlayPlacement(source.vertical)
    || hasExplicitOverlayPlacement(source.horizontal);
}

function normalizeStoryOverlayProfile(value = {}, asset = {}) {
  return constrainStoryOverlayPlacement(normalizeOverlayPlacement(value), asset);
}

function overlayOrientationForDimensions(width, height) {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  return Number.isFinite(safeHeight) && Number.isFinite(safeWidth) && safeHeight > safeWidth
    ? 'portrait'
    : 'landscape';
}

function overlayPlacementForOrientation(value = {}, orientation = 'landscape') {
  const settings = normalizeOverlaySettings(value);
  return orientation === 'portrait' ? settings.portrait : settings.landscape;
}

function overlayPlacementForDimensions(value = {}, width, height) {
  return overlayPlacementForOrientation(value, overlayOrientationForDimensions(width, height));
}

module.exports = {
  DEFAULT_OVERLAY_PLACEMENT,
  DEFAULT_OVERLAY_SETTINGS,
  OVERLAY_ORIENTATIONS,
  STORY_OVERLAY_DIMENSIONS,
  hasExplicitOverlayPlacement,
  hasExplicitOverlaySettings,
  normalizeOverlayPlacement,
  normalizeOverlaySettings,
  normalizeStoryOverlayProfile,
  overlayOrientationForDimensions,
  overlayPlacementForDimensions,
  overlayPlacementForOrientation,
};
