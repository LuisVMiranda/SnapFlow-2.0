export function StoryDeliverySettingsPanel({
  onSave = () => {},
  settings = { defaultEnabled: false },
  status = 'idle',
}) {
  const isSaving = status === 'saving';

  return (
    <div className="story-delivery-settings">
      <label className="summary-label story-delivery-toggle">
        <input
          checked={settings.defaultEnabled}
          type="checkbox"
          onChange={(event) => onSave({ defaultEnabled: event.target.checked })}
        />
        Ativar entrega Stories 9:16 por padrão em novas galerias
      </label>
      <small className="summary-help">
        Cada galeria ainda pode ligar ou desligar a versão Stories. Se houver overlay com ajuste 9:16, ele entra na cópia Stories; caso contrário, a cópia sai sem overlay.
      </small>
      {isSaving ? <small className="summary-help">Salvando entrega Stories...</small> : null}
    </div>
  );
}
