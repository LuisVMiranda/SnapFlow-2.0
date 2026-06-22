import { DeliveryModeControl } from './DeliveryModeControl';

export function DeliveryModeSettingsPanel({
  onSave = () => {},
  settings = { defaultDeliveryMode: 'both' },
  status = 'idle',
}) {
  const isSaving = status === 'saving';

  return (
    <div className="delivery-mode-settings">
      <div className="summary-label">Entrega padrão das galerias</div>
      <DeliveryModeControl
        compact
        idPrefix="default-delivery-mode"
        value={settings.defaultDeliveryMode}
        onChange={(defaultDeliveryMode) => onSave({ defaultDeliveryMode })}
      />
      <small className="summary-help">
        Este valor entra automaticamente em novas galerias. Cada galeria ainda pode ser ajustada ao criar ou editar.
      </small>
      {isSaving ? <small className="summary-help">Salvando modo de entrega...</small> : null}
    </div>
  );
}
