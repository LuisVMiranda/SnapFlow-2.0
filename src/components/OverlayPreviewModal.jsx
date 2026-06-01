import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  OVERLAY_ORIENTATIONS,
  normalizeOverlaySettings,
  overlayPlacementForOrientation,
} from '../hooks/useOverlaySettings';

const ORIENTATION_LABELS = {
  portrait: 'Vertical',
  landscape: 'Horizontal',
};

function clampPoint(value) {
  return Math.min(1, Math.max(0, value));
}

export function OverlayPreviewModal({
  assets = [],
  initialAssetId = '',
  initialSettings = {},
  isOpen,
  onClose,
  onSave,
  previewUrl = '',
}) {
  const frameRefs = useRef({});
  const didInitializeRef = useRef(false);
  const isDraggingRef = useRef(false);
  const [activeOrientation, setActiveOrientation] = useState('portrait');
  const [assetId, setAssetId] = useState(initialAssetId);
  const [settings, setSettings] = useState(() => normalizeOverlaySettings(initialSettings));
  const firstAssetId = assets[0]?.id || '';
  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === assetId), [assets, assetId]);
  const activePlacement = overlayPlacementForOrientation(settings, activeOrientation);

  useEffect(() => {
    if (!isOpen) {
      didInitializeRef.current = false;
      return;
    }
    if (didInitializeRef.current) return;
    setAssetId(initialAssetId || firstAssetId);
    setSettings(normalizeOverlaySettings(initialSettings));
    setActiveOrientation('portrait');
    didInitializeRef.current = true;
  }, [firstAssetId, initialAssetId, initialSettings, isOpen]);

  useEffect(() => {
    if (!isOpen || assetId || !firstAssetId) return;
    setAssetId(initialAssetId || firstAssetId);
  }, [assetId, firstAssetId, initialAssetId, isOpen]);

  if (!isOpen) return null;

  const updatePlacement = (orientation, patch) => {
    setSettings((current) => {
      const normalized = normalizeOverlaySettings(current);
      const currentPlacement = overlayPlacementForOrientation(normalized, orientation);
      return normalizeOverlaySettings({
        ...normalized,
        [orientation]: {
          ...currentPlacement,
          ...patch,
        },
      });
    });
  };

  const updateFromPointer = (event, orientation) => {
    const rect = frameRefs.current[orientation]?.getBoundingClientRect();
    if (!rect) return;
    setActiveOrientation(orientation);
    updatePlacement(orientation, {
      x: clampPoint((event.clientX - rect.left) / rect.width),
      y: clampPoint((event.clientY - rect.top) / rect.height),
    });
  };

  const stopDrag = (event) => {
    isDraggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const save = () => {
    if (!assetId) return;
    onSave({ assetId, enabled: true, settings: normalizeOverlaySettings(settings) });
  };

  return (
    <div className="modal-backdrop overlay-preview-backdrop" role="dialog" aria-modal="true" aria-label="Ajustar overlay da galeria">
      <div className="modal-card overlay-preview-modal">
        <div className="modal-header">
          <strong>Ajustar overlay</strong>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <label>
          Overlay
          <select className="phone-input" value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            <option value="">Selecione</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.identifier}</option>
            ))}
          </select>
        </label>

        <div className="overlay-orientation-tabs" role="tablist" aria-label="Orientacao do overlay">
          {OVERLAY_ORIENTATIONS.map((orientation) => (
            <button
              aria-selected={activeOrientation === orientation}
              className="share-quick-btn"
              data-active={activeOrientation === orientation}
              key={orientation}
              onClick={() => setActiveOrientation(orientation)}
              role="tab"
              type="button"
            >
              {ORIENTATION_LABELS[orientation]}
            </button>
          ))}
        </div>

        <div className="overlay-preview-grid">
          {OVERLAY_ORIENTATIONS.map((orientation) => {
            const placement = overlayPlacementForOrientation(settings, orientation);
            return (
              <div className="overlay-preview-panel" key={orientation}>
                <small>{ORIENTATION_LABELS[orientation]}</small>
                <div
                  className={`overlay-preview-frame overlay-preview-frame-${orientation}`}
                  data-active={activeOrientation === orientation}
                  data-orientation={orientation}
                  ref={(node) => {
                    if (node) frameRefs.current[orientation] = node;
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    isDraggingRef.current = true;
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    updateFromPointer(event, orientation);
                  }}
                  onPointerMove={(event) => {
                    if (isDraggingRef.current) updateFromPointer(event, orientation);
                  }}
                  onPointerCancel={stopDrag}
                  onPointerUp={stopDrag}
                >
                  {previewUrl ? <img alt="" className="overlay-preview-photo" draggable={false} src={previewUrl} /> : <div className="share-gallery-empty">Adicione uma foto antes de configurar overlay.</div>}
                  {selectedAsset ? (
                    <img
                      alt=""
                      className="overlay-preview-layer"
                      draggable={false}
                      src={selectedAsset.url}
                      style={{
                        left: `${placement.x * 100}%`,
                        opacity: placement.opacity,
                        top: `${placement.y * 100}%`,
                        width: `${placement.widthRatio * 100}%`,
                      }}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="watermark-controls gallery-watermark-controls">
          <label>
            <span>Opacidade</span>
            <input
              className="watermark-range"
              max="1"
              min="0.05"
              onChange={(event) => updatePlacement(activeOrientation, { opacity: event.target.value })}
              step="0.05"
              type="range"
              value={activePlacement.opacity}
            />
            <small>{Math.round(activePlacement.opacity * 100)}%</small>
          </label>
          <label>
            <span>Tamanho</span>
            <input
              className="watermark-range"
              max="1.5"
              min="0.05"
              onChange={(event) => updatePlacement(activeOrientation, { widthRatio: event.target.value })}
              step="0.05"
              type="range"
              value={activePlacement.widthRatio}
            />
            <small>{Math.round(activePlacement.widthRatio * 100)}%</small>
          </label>
        </div>

        <div className="share-edit-actions">
          <button className="btn-primary" disabled={!assetId || !previewUrl} type="button" onClick={save}>Salvar overlay</button>
          <button className="btn-manual btn-manual-card" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
