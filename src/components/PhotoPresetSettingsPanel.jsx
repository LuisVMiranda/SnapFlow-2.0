import { useEffect, useMemo, useState } from 'react';
import { PhotoPresetPreview } from './PhotoPresetPreview';
import {
  DEFAULT_PHOTO_PRESET_SETTINGS,
  PHOTO_PRESET_BOUNDS,
  clampPhotoPresetValue,
  normalizePhotoPresetSettings,
} from '../lib/photoPresets';

function emptyDraft() {
  return {
    id: '',
    name: '',
    description: '',
    enabled: true,
    settings: { ...DEFAULT_PHOTO_PRESET_SETTINGS },
  };
}

function draftFromPreset(preset) {
  return {
    id: preset.id || '',
    name: preset.name || '',
    description: preset.description || '',
    enabled: preset.enabled !== false,
    settings: normalizePhotoPresetSettings(preset.settings),
  };
}

function formatPresetValue(value) {
  return String(value ?? '');
}

function isPendingNumberInput(value) {
  return ['', '-', '+', '.', ',', '-.', '-,', '+.', '+,'].includes(value.trim());
}

function PhotoPresetControl({ bounds, settingKey, updateSetting, value }) {
  const [manualValue, setManualValue] = useState(formatPresetValue(value));
  const [isEditingNumber, setIsEditingNumber] = useState(false);
  const inputId = `photo-preset-${settingKey}`;
  const numberId = `${inputId}-number`;

  useEffect(() => {
    if (!isEditingNumber) setManualValue(formatPresetValue(value));
  }, [isEditingNumber, value]);

  const updateNumericValue = (nextValue) => {
    updateSetting(settingKey, clampPhotoPresetValue(settingKey, nextValue));
  };

  const handleNumberChange = (event) => {
    const nextValue = event.target.value;
    setManualValue(nextValue);
    if (isPendingNumberInput(nextValue)) return;
    const parsed = Number(nextValue.replace(',', '.'));
    if (Number.isFinite(parsed)) updateNumericValue(parsed);
  };

  const handleNumberBlur = () => {
    const normalized = clampPhotoPresetValue(settingKey, manualValue.replace(',', '.'));
    setIsEditingNumber(false);
    setManualValue(formatPresetValue(normalized));
    updateSetting(settingKey, normalized);
  };

  return (
    <div className="photo-preset-control">
      <div className="photo-preset-control-header">
        <label htmlFor={inputId}>{bounds.label}</label>
        <input
          aria-label={`Valor de ${bounds.label}`}
          className="photo-preset-number"
          id={numberId}
          inputMode="decimal"
          max={bounds.max}
          min={bounds.min}
          step={bounds.step}
          type="number"
          value={manualValue}
          onBlur={handleNumberBlur}
          onChange={handleNumberChange}
          onFocus={() => setIsEditingNumber(true)}
        />
      </div>
      <input
        aria-label={`Slider de ${bounds.label}`}
        id={inputId}
        max={bounds.max}
        min={bounds.min}
        step={bounds.step}
        type="range"
        value={value}
        onChange={(event) => updateNumericValue(Number(event.target.value))}
      />
    </div>
  );
}

export function PhotoPresetSettingsPanel({
  createPhotoPreset,
  deletePhotoPreset,
  embedded = false,
  photoPresets = [],
  status = 'idle',
  updatePhotoPreset,
}) {
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const isEditing = Boolean(editingId);
  const previewStack = useMemo(() => [{ ...draft, settings: normalizePhotoPresetSettings(draft.settings) }], [draft]);

  const resetDraft = () => {
    setEditingId('');
    setDraft(emptyDraft());
  };

  const editPreset = (preset) => {
    if (editingId && !window.confirm('Descartar alterações do preset atual e abrir outro?')) return;
    setEditingId(preset.id);
    setDraft(draftFromPreset(preset));
  };

  const saveDraft = async () => {
    const normalized = {
      ...draft,
      settings: normalizePhotoPresetSettings(draft.settings),
    };
    if (!normalized.name.trim()) {
      window.alert('Informe um nome para o preset antes de salvar.');
      return;
    }
    if (isEditing && !window.confirm('Salvar alterações neste preset de edição?')) return;
    const result = isEditing
      ? await updatePhotoPreset(editingId, normalized)
      : await createPhotoPreset(normalized);
    if (result) resetDraft();
  };

  const removePreset = async (preset) => {
    if (!window.confirm(`Remover o preset "${preset.name}"? Galerias que já usam esse ajuste não serão alteradas automaticamente.`)) return;
    const result = await deletePhotoPreset(preset.id);
    if (result && editingId === preset.id) resetDraft();
  };

  const updateSetting = (key, value) => {
    setDraft((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        [key]: value,
      },
    }));
  };

  return (
    <div className={`${embedded ? '' : 'summary-card '}photo-preset-panel`}>
      <div className="photo-preset-layout">
        <div className="photo-preset-list" aria-label="Presets salvos">
          {photoPresets.length ? photoPresets.map((preset) => (
            <div className="photo-preset-list-item" key={preset.id}>
              <button type="button" className="share-quick-btn photo-preset-list-button" onClick={() => editPreset(preset)}>
                {preset.name}
              </button>
              <button type="button" className="share-quick-btn share-quick-btn-danger photo-preset-list-button photo-preset-remove-button" onClick={() => removePreset(preset)}>
                Remover
              </button>
              {preset.description ? <small>{preset.description}</small> : null}
            </div>
          )) : (
            <div className="share-gallery-empty">Nenhum preset criado ainda.</div>
          )}
        </div>

        <div className="photo-preset-editor">
          <label>
            Nome do preset
            <input
              className="phone-input"
              maxLength={80}
              value={draft.name}
              onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Ex.: Evento noturno"
            />
          </label>
          <label>
            Descrição
            <input
              className="phone-input"
              maxLength={240}
              value={draft.description}
              onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))}
              placeholder="Quando usar este ajuste"
            />
          </label>
          <label className="summary-label photo-preset-enabled">
            <input
              checked={draft.enabled}
              type="checkbox"
              onChange={(event) => setDraft((previous) => ({ ...previous, enabled: event.target.checked }))}
            />
            Preset disponível para galerias
          </label>
          <small className="summary-help">
            Use Sombras para recuperar ou aprofundar áreas escuras, Pretos para ajustar o ponto preto e Brancos para segurar ou destacar áreas claras.
          </small>

          <div className="photo-preset-sliders">
            {Object.entries(PHOTO_PRESET_BOUNDS).map(([key, bounds]) => (
              <PhotoPresetControl
                bounds={bounds}
                key={key}
                settingKey={key}
                updateSetting={updateSetting}
                value={draft.settings[key]}
              />
            ))}
          </div>

          <div className="share-edit-actions">
            <button className="btn-primary" disabled={status === 'saving'} type="button" onClick={saveDraft}>
              {status === 'saving' ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar preset'}
            </button>
            <button className="btn-manual btn-manual-card" type="button" onClick={resetDraft}>
              Resetar
            </button>
          </div>
        </div>

        <PhotoPresetPreview presetStack={previewStack} />
      </div>
    </div>
  );
}
