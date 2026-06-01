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
  const hasPlacementFields = (candidate = {}) => ['x', 'y', 'widthRatio', 'opacity'].some((field) => (
    candidate?.[field] !== undefined && candidate?.[field] !== null
  ));
  return hasPlacementFields(source)
    || OVERLAY_ORIENTATIONS.some((orientation) => hasPlacementFields(source[orientation]))
    || hasPlacementFields(source.vertical)
    || hasPlacementFields(source.horizontal);
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
  hasExplicitOverlaySettings,
  normalizeOverlayPlacement,
  normalizeOverlaySettings,
  overlayOrientationForDimensions,
  overlayPlacementForDimensions,
  overlayPlacementForOrientation,
};
