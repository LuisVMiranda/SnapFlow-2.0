export const DEFAULT_OVERLAY_SETTINGS = Object.freeze({
  x: 0.5,
  y: 0.5,
  widthRatio: 0.35,
  opacity: 0.75,
});

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeOverlaySettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    x: Number(clampNumber(source.x, DEFAULT_OVERLAY_SETTINGS.x, 0, 1).toFixed(4)),
    y: Number(clampNumber(source.y, DEFAULT_OVERLAY_SETTINGS.y, 0, 1).toFixed(4)),
    widthRatio: Number(clampNumber(source.widthRatio, DEFAULT_OVERLAY_SETTINGS.widthRatio, 0.05, 1.5).toFixed(4)),
    opacity: Number(clampNumber(source.opacity, DEFAULT_OVERLAY_SETTINGS.opacity, 0.05, 1).toFixed(2)),
  };
}
