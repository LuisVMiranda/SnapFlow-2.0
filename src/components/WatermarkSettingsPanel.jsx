import { Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_WATERMARK_SETTINGS, normalizeWatermarkSettings } from '../hooks/useWatermarkSettings';

function watermarkPreviewPositions(instances) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(instances * 1.6)));
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

function watermarkPreviewSize(settings) {
  return {
    width: `${Math.min(82, Math.max(26, (settings.width / 900) * 100))}%`,
    height: `${Math.min(38, Math.max(12, (settings.height / 360) * 100))}%`,
    opacity: settings.opacity,
  };
}

export function WatermarkSettingsPanel({
  onSave,
  settings = DEFAULT_WATERMARK_SETTINGS,
  status = 'idle',
}) {
  const [draft, setDraft] = useState(() => normalizeWatermarkSettings(settings));
  const isSaving = status === 'saving';
  const normalizedDraft = useMemo(() => normalizeWatermarkSettings(draft), [draft]);
  const positions = useMemo(
    () => watermarkPreviewPositions(normalizedDraft.instances),
    [normalizedDraft.instances]
  );
  const sizeStyle = watermarkPreviewSize(normalizedDraft);

  useEffect(() => {
    setDraft(normalizeWatermarkSettings(settings));
  }, [settings]);

  const updateField = (field, value) => {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (typeof onSave === 'function') await onSave(normalizedDraft);
  };

  return (
    <div className="summary-card watermark-settings-card">
      <div className="watermark-settings-header">
        <div>
          <div className="summary-label">Marca d&apos;água das prévias</div>
          <small className="summary-help">
            Ajuste como o texto SnapFlow aparece nas imagens de prévia enviadas ao cliente.
          </small>
        </div>
        <button
          type="button"
          className="btn-manual btn-manual-card watermark-save-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save size={16} />
          {isSaving ? 'Salvando...' : "Salvar marca d'água"}
        </button>
      </div>

      <div className="watermark-settings-layout">
        <div className="watermark-controls" aria-label="Controles da marca d'água">
          <label>
            <span>Largura</span>
            <input
              className="phone-input"
              type="number"
              min="120"
              max="900"
              step="10"
              value={draft.width}
              onChange={(event) => updateField('width', event.target.value)}
            />
            <small>{normalizedDraft.width}px</small>
          </label>

          <label>
            <span>Altura</span>
            <input
              className="phone-input"
              type="number"
              min="40"
              max="360"
              step="10"
              value={draft.height}
              onChange={(event) => updateField('height', event.target.value)}
            />
            <small>{normalizedDraft.height}px</small>
          </label>

          <label>
            <span>Opacidade</span>
            <input
              className="watermark-range"
              type="range"
              min="0.05"
              max="0.95"
              step="0.05"
              value={draft.opacity}
              onChange={(event) => updateField('opacity', event.target.value)}
            />
            <small>{Math.round(normalizedDraft.opacity * 100)}%</small>
          </label>

          <label>
            <span>Repetições</span>
            <input
              className="phone-input"
              type="number"
              min="1"
              max="24"
              step="1"
              value={draft.instances}
              onChange={(event) => updateField('instances', event.target.value)}
            />
            <small>{normalizedDraft.instances} instância(s)</small>
          </label>
        </div>

        <div className="watermark-preview-panel" aria-label="Prévia da marca d'água">
          <div className="watermark-preview-frame">
            {positions.map((position, index) => (
              <span
                className="watermark-preview-instance"
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
          <small className="summary-help">
            A prévia representa a distribuição visual; novas fotos enviadas usarão esses parâmetros.
          </small>
        </div>
      </div>
    </div>
  );
}
