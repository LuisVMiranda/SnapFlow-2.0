import { useEffect, useRef, useState } from 'react';
import { overlayPlacementForOrientation } from '../hooks/useOverlaySettings';

function imageOrientation(image) {
  return Number(image?.naturalHeight || 0) > Number(image?.naturalWidth || 0) ? 'portrait' : 'landscape';
}

export function GalleryOverlayLayer({ settings = {}, orientation: fixedOrientation = '' }) {
  const safeSettings = settings && typeof settings === 'object' ? settings : {};
  const layerRef = useRef(null);
  const [orientation, setOrientation] = useState(fixedOrientation || 'landscape');

  useEffect(() => {
    if (fixedOrientation) {
      setOrientation(fixedOrientation);
      return undefined;
    }
    const parent = layerRef.current?.parentElement;
    const image = Array.from(parent?.children || []).find((child) => child.tagName === 'IMG');
    if (!image) return undefined;
    const updateOrientation = () => setOrientation(imageOrientation(image));
    updateOrientation();
    image.addEventListener('load', updateOrientation);
    return () => image.removeEventListener('load', updateOrientation);
  }, [fixedOrientation, safeSettings.assetUrl]);

  if (!safeSettings.enabled || safeSettings.kind !== 'image' || !safeSettings.assetUrl) return null;
  const placement = overlayPlacementForOrientation(safeSettings, orientation);
  const x = Number.isFinite(Number(placement.x)) ? Number(placement.x) : 0.5;
  const y = Number.isFinite(Number(placement.y)) ? Number(placement.y) : 0.5;
  const widthRatio = Number.isFinite(Number(placement.widthRatio)) ? Number(placement.widthRatio) : 0.35;
  const opacity = Number.isFinite(Number(placement.opacity)) ? Number(placement.opacity) : 0.75;

  return (
    <div className="gallery-client-overlay" aria-hidden="true" ref={layerRef}>
      <img
        alt=""
        src={safeSettings.assetUrl}
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
