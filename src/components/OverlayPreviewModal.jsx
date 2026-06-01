import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { normalizeOverlaySettings } from '../hooks/useOverlaySettings';

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
  const frameRef = useRef(null);
  const didInitializeRef = useRef(false);
  const isDraggingRef = useRef(false);
  const [assetId, setAssetId] = useState(initialAssetId);
  const [settings, setSettings] = useState(() => normalizeOverlaySettings(initialSettings));
  const firstAssetId = assets[0]?.id || '';
  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === assetId), [assets, assetId]);

  useEffect(() => {
    if (!isOpen) {
      didInitializeRef.current = false;
      return;
    }
    if (didInitializeRef.current) return;
    setAssetId(initialAssetId || firstAssetId);
    setSettings(normalizeOverlaySettings(initialSettings));
    didInitializeRef.current = true;
  }, [firstAssetId, initialAssetId, initialSettings, isOpen]);

  useEffect(() => {
    if (!isOpen || assetId || !firstAssetId) return;
    setAssetId(initialAssetId || firstAssetId);
  }, [assetId, firstAssetId, initialAssetId, isOpen]);

  if (!isOpen) return null;

  const updateFromPointer = (event) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSettings((current) => normalizeOverlaySettings({
      ...current,
      x: clampPoint((event.clientX - rect.left) / rect.width),
      y: clampPoint((event.clientY - rect.top) / rect.height),
    }));
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

        <div
          className="overlay-preview-frame"
          ref={frameRef}
          onPointerDown={(event) => {
            event.preventDefault();
            isDraggingRef.current = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            updateFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (isDraggingRef.current) updateFromPointer(event);
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
                left: `${settings.x * 100}%`,
                opacity: settings.opacity,
                top: `${settings.y * 100}%`,
                width: `${settings.widthRatio * 100}%`,
              }}
            />
          ) : null}
        </div>

        <div className="watermark-controls gallery-watermark-controls">
          <label>
            <span>Opacidade</span>
            <input
              className="watermark-range"
              max="1"
              min="0.05"
              onChange={(event) => setSettings((current) => normalizeOverlaySettings({ ...current, opacity: event.target.value }))}
              step="0.05"
              type="range"
              value={settings.opacity}
            />
            <small>{Math.round(settings.opacity * 100)}%</small>
          </label>
          <label>
            <span>Tamanho</span>
            <input
              className="watermark-range"
              max="1.5"
              min="0.05"
              onChange={(event) => setSettings((current) => normalizeOverlaySettings({ ...current, widthRatio: event.target.value }))}
              step="0.05"
              type="range"
              value={settings.widthRatio}
            />
            <small>{Math.round(settings.widthRatio * 100)}%</small>
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
