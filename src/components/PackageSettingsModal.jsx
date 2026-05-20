import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { normalizePricingOptions } from '../lib/pricing';

function createPackageKey(existing) {
  let index = Object.keys(existing).length + 1;
  let key = `pacote_${index}`;
  while (existing[key]) {
    index += 1;
    key = `pacote_${index}`;
  }
  return key;
}

export function PackageSettingsModal({
  isOpen,
  onClose,
  onSave,
  pricingOptions,
  status,
}) {
  const [draft, setDraft] = useState(pricingOptions);

  useEffect(() => {
    if (isOpen) setDraft(normalizePricingOptions(pricingOptions));
  }, [isOpen, pricingOptions]);

  if (!isOpen) return null;

  const entries = Object.entries(draft);
  const updatePackage = (key, field, value) => {
    setDraft((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        [field]: ['unit', 'bulk', 'threshold'].includes(field) ? Number(value) : value,
      },
    }));
  };

  const addPackage = () => {
    setDraft((previous) => {
      const key = createPackageKey(previous);
      return {
        ...previous,
        [key]: {
          label: 'Novo pacote',
          shortLabel: 'Novo',
          description: 'Ajuste o preço e a quantidade mínima.',
          unit: 15,
          bulk: 10,
          threshold: 5,
        },
      };
    });
  };

  const removePackage = (key) => {
    setDraft((previous) => {
      const next = { ...previous };
      delete next[key];
      return Object.keys(next).length ? next : previous;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const saved = await onSave(draft);
    if (saved) onClose();
  };

  return (
    <div className="account-modal-backdrop" role="presentation">
      <section className="package-settings-modal" role="dialog" aria-modal="true" aria-labelledby="package-settings-title">
        <header className="account-modal-header">
          <div>
            <h2 id="package-settings-title">Pacotes de fotos</h2>
            <small>Edite quantidade mínima, preços e opções disponíveis.</small>
          </div>
          <button type="button" className="account-icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <form className="package-settings-form" onSubmit={handleSubmit}>
          {entries.map(([key, option]) => (
            <fieldset key={key} className="package-settings-item">
              <div className="package-settings-item-header">
                <legend>{option.shortLabel || option.label || key}</legend>
                <button
                  type="button"
                  className="package-remove-button"
                  onClick={() => removePackage(key)}
                  disabled={entries.length <= 1}
                  aria-label={`Remover ${option.label}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <label>
                Nome completo
                <input value={option.label} onChange={(event) => updatePackage(key, 'label', event.target.value)} />
              </label>
              <label>
                Nome curto
                <input value={option.shortLabel} onChange={(event) => updatePackage(key, 'shortLabel', event.target.value)} />
              </label>
              <label>
                Descrição
                <textarea value={option.description} onChange={(event) => updatePackage(key, 'description', event.target.value)} />
              </label>
              <div className="package-number-grid">
                <label>
                  Fotos para desconto
                  <input min="1" type="number" value={option.threshold} onChange={(event) => updatePackage(key, 'threshold', event.target.value)} />
                </label>
                <label>
                  Preço normal
                  <input min="1" step="0.5" type="number" value={option.unit} onChange={(event) => updatePackage(key, 'unit', event.target.value)} />
                </label>
                <label>
                  Preço promocional
                  <input min="1" step="0.5" type="number" value={option.bulk} onChange={(event) => updatePackage(key, 'bulk', event.target.value)} />
                </label>
              </div>
            </fieldset>
          ))}

          <button type="button" className="package-add-button" onClick={addPackage}>
            <Plus size={16} />
            Adicionar pacote
          </button>

          <button className="btn-primary" type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? 'Salvando pacotes...' : 'Salvar pacotes'}
          </button>
        </form>
      </section>
    </div>
  );
}
