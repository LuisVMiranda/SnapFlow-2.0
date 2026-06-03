import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { normalizeStoryOverlayProfile } from '../hooks/useOverlaySettings';

const STORY_PREVIEW_MODES = [
  { id: 'portrait', label: 'Vertical' },
  { id: 'landscape', label: 'Horizontal' },
];

function clampPoint(value) {
  return Math.min(1, Math.max(0, value));
}

export function StoryOverlayProfileModal({
  asset,
  initialSettings = {},
  isOpen,
  onClose,
  onSave,
}) {
  const frameRef = useRef(null);
  const isDraggingRef = useRef(false);
  const [previewMode, setPreviewMode] = useState('portrait');
  const [settings, setSettings] = useState(() => normalizeStoryOverlayProfile(initialSettings, asset));

  useEffect(() => {
    if (isOpen) setSettings(normalizeStoryOverlayProfile(initialSettings, asset));
  }, [asset, initialSettings, isOpen]);

  if (!isOpen || !asset) return null;

  const updateSettings = (patch) => {
    setSettings((current) => normalizeStoryOverlayProfile({ ...current, ...patch }, asset));
  };

  const updateFromPointer = (event) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    updateSettings({
      x: clampPoint((event.clientX - rect.left) / rect.width),
      y: clampPoint((event.clientY - rect.top) / rect.height),
    });
  };

  const stopDrag = (event) => {
    isDraggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div className="modal-backdrop overlay-preview-backdrop" role="dialog" aria-modal="true" aria-label="Ajustar overlay para Stories">
      <div className="modal-card overlay-preview-modal story-overlay-modal">
        <div className="modal-header">
          <strong>Overlay para Stories</strong>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="story-overlay-editor">
          <div
            className={`overlay-preview-frame overlay-preview-frame-story story-preview-${previewMode}`}
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
            <div className="story-overlay-backdrop" />
            <div className="story-preview-subject" aria-hidden="true" />
            <img
              alt=""
              className="overlay-preview-layer"
              draggable={false}
              src={asset.url}
              style={{
                left: `${settings.x * 100}%`,
                opacity: settings.opacity,
                top: `${settings.y * 100}%`,
                width: `${settings.widthRatio * 100}%`,
              }}
            />
          </div>

          <div className="watermark-controls story-overlay-controls">
            <div className="story-preview-mode" role="group" aria-label="Tipo de foto na prévia Stories">
              {STORY_PREVIEW_MODES.map((mode) => (
                <button
                  className={previewMode === mode.id ? 'share-quick-btn approve-session-btn' : 'share-quick-btn'}
                  key={mode.id}
                  onClick={() => setPreviewMode(mode.id)}
                  type="button"
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <label>
              <span>Opacidade</span>
              <input
                className="watermark-range"
                max="1"
                min="0.05"
                onChange={(event) => updateSettings({ opacity: event.target.value })}
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
                onChange={(event) => updateSettings({ widthRatio: event.target.value })}
                step="0.05"
                type="range"
                value={settings.widthRatio}
              />
              <small>{Math.round(settings.widthRatio * 100)}%</small>
            </label>
          </div>
        </div>

        <div className="share-edit-actions">
          <button className="btn-primary" type="button" onClick={() => onSave(normalizeStoryOverlayProfile(settings, asset))}>
            Salvar Stories
          </button>
          <button className="btn-manual btn-manual-card" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
