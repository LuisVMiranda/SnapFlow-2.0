export const DEFAULT_OVERLAY_PLACEMENT = Object.freeze({
  x: 0.5,
  y: 0.5,
  widthRatio: 0.35,
  opacity: 0.75,
});

export const OVERLAY_ORIENTATIONS = Object.freeze(['portrait', 'landscape']);

export const DEFAULT_OVERLAY_SETTINGS = Object.freeze({
  ...DEFAULT_OVERLAY_PLACEMENT,
  portrait: DEFAULT_OVERLAY_PLACEMENT,
  landscape: DEFAULT_OVERLAY_PLACEMENT,
});

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeOverlayPlacement(value = {}, fallback = DEFAULT_OVERLAY_PLACEMENT) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    x: Number(clampNumber(source.x, fallback.x, 0, 1).toFixed(4)),
    y: Number(clampNumber(source.y, fallback.y, 0, 1).toFixed(4)),
    widthRatio: Number(clampNumber(source.widthRatio, fallback.widthRatio, 0.05, 1.5).toFixed(4)),
    opacity: Number(clampNumber(source.opacity, fallback.opacity, 0.05, 1).toFixed(2)),
  };
}

export function normalizeOverlaySettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const base = normalizeOverlayPlacement(source);
  return {
    ...base,
    portrait: normalizeOverlayPlacement(source.portrait || source.vertical || {}, base),
    landscape: normalizeOverlayPlacement(source.landscape || source.horizontal || {}, base),
  };
}

export function overlayPlacementForOrientation(value = {}, orientation = 'landscape') {
  const settings = normalizeOverlaySettings(value);
  return orientation === 'portrait' ? settings.portrait : settings.landscape;
}
