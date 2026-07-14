import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { GalleryDeliveryControl } from './GalleryDeliveryControl';

export function DeliveryModeSettingsPanel({
  onSave = () => {},
  settings = {
    defaultDeliveryMode: 'download',
    defaultPostPaymentAccessDays: 7,
    defaultSendOriginalsViaWhatsapp: false,
  },
  status = 'idle',
}) {
  const isSaving = status === 'saving';
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const updateMode = (defaultDeliveryMode) => setDraft((current) => ({
    ...current,
    defaultDeliveryMode,
    defaultSendOriginalsViaWhatsapp: defaultDeliveryMode !== 'download',
  }));

  const updateAccessDays = (defaultPostPaymentAccessDays) => setDraft((current) => ({
    ...current,
    defaultPostPaymentAccessDays,
  }));

  return (
    <div className="delivery-mode-settings">
      <div className="summary-label">Entrega padrão das galerias</div>
      <GalleryDeliveryControl
        disabled={isSaving}
        idPrefix="default-delivery-mode"
        mode={draft.defaultDeliveryMode}
        postPaymentAccessDays={draft.defaultPostPaymentAccessDays}
        onAccessDaysChange={updateAccessDays}
        onModeChange={updateMode}
      />
      <small className="summary-help">
        Estes valores entram automaticamente em novas galerias e podem ser alterados em cada uma delas.
      </small>
      {isSaving ? <small className="summary-help">Salvando entrega...</small> : null}
      <button
        className="btn-manual btn-manual-card whatsapp-template-save"
        disabled={isSaving}
        type="button"
        onClick={() => onSave(draft)}
      >
        <Save size={16} />
        Salvar entrega
      </button>
    </div>
  );
}
