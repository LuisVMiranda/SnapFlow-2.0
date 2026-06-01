export function GalleryOverlayLayer({ settings = {} }) {
  if (!settings.enabled || settings.kind !== 'image' || !settings.assetUrl) return null;
  const x = Number.isFinite(Number(settings.x)) ? Number(settings.x) : 0.5;
  const y = Number.isFinite(Number(settings.y)) ? Number(settings.y) : 0.5;
  const widthRatio = Number.isFinite(Number(settings.widthRatio)) ? Number(settings.widthRatio) : 0.35;
  const opacity = Number.isFinite(Number(settings.opacity)) ? Number(settings.opacity) : 0.75;

  return (
    <div className="gallery-client-overlay" aria-hidden="true">
      <img
        alt=""
        src={settings.assetUrl}
        style={{
          left: `${Math.min(1, Math.max(0, x)) * 100}%`,
          opacity: Math.min(1, Math.max(0.05, opacity)),
          top: `${Math.min(1, Math.max(0, y)) * 100}%`,
          width: `${Math.min(1.5, Math.max(0.05, widthRatio)) * 100}%`,
        }}
      />
    </div>
  );
}
