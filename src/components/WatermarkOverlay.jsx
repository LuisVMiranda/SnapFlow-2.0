import { useMemo } from 'react';
import { DEFAULT_WATERMARK_SETTINGS, normalizeWatermarkSettings } from '../hooks/useWatermarkSettings';

function overlayPositions(instances) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(instances * 1.5)));
  const rows = Math.max(1, Math.ceil(instances / columns));
  return Array.from({ length: instances }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      left: `${((column + 0.5) * 100) / columns}%`,
      top: `${((row + 0.5) * 100) / rows}%`,
    };
  });
}

function overlaySize(settings) {
  return {
    width: `${Math.min(80, Math.max(34, (settings.width / 900) * 100))}%`,
    minHeight: `${Math.min(44, Math.max(18, (settings.height / 360) * 100))}%`,
    opacity: settings.opacity,
  };
}

export function WatermarkOverlay({ settings = DEFAULT_WATERMARK_SETTINGS }) {
  const normalized = normalizeWatermarkSettings(settings);
  const positions = useMemo(() => overlayPositions(normalized.instances), [normalized.instances]);
  const sizeStyle = overlaySize(normalized);

  return (
    <div className="watermark-overlay" aria-hidden="true">
      {positions.map((position, index) => (
        <span
          className="preview-watermark"
          key={`${position.left}-${position.top}-${index}`}
          style={{
            ...position,
            ...sizeStyle,
          }}
        >
          SnapFlow
        </span>
      ))}
    </div>
  );
}
