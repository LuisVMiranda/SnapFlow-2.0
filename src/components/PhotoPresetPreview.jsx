import { useState } from 'react';
import { Eye } from 'lucide-react';
import { buildPresetFilter } from '../lib/photoPresets';

export function PhotoPresetPreview({
  compact = false,
  imageAlt = 'Prévia da primeira foto da galeria',
  imageUrl = '',
  label = 'Prévia do preset',
  presetStack = [],
}) {
  const [showBefore, setShowBefore] = useState(false);
  const filter = buildPresetFilter(presetStack);
  const showOriginal = () => setShowBefore(true);
  const showEdited = () => setShowBefore(false);

  return (
    <div className={`photo-preset-preview ${compact ? 'photo-preset-preview-compact' : ''}`} aria-label={label}>
      <div className="photo-preset-mock" data-before={showBefore ? 'true' : 'false'}>
        {imageUrl ? (
          <img
            alt={imageAlt}
            className="photo-preset-real-image"
            src={imageUrl}
            style={{ filter: showBefore ? 'none' : filter }}
          />
        ) : (
          <div className="photo-preset-mock-image" style={{ filter: showBefore ? 'none' : filter }}>
            <span className="photo-preset-mock-sky" />
            <span className="photo-preset-mock-face" />
            <span className="photo-preset-mock-shirt" />
            <span className="photo-preset-mock-ground" />
          </div>
        )}
      </div>
      <button
        className="share-quick-btn photo-preset-before-button"
        aria-label="Segurar para ver a foto original"
        data-active={showBefore ? 'true' : 'false'}
        title="Segurar para ver a foto original"
        type="button"
        onBlur={showEdited}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') showOriginal();
        }}
        onKeyUp={showEdited}
        onPointerCancel={showEdited}
        onPointerDown={showOriginal}
        onPointerLeave={showEdited}
        onPointerUp={showEdited}
      >
        <Eye size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
