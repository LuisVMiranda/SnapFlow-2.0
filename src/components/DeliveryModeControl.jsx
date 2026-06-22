import { DELIVERY_MODE_OPTIONS, normalizeDeliveryMode } from '../lib/deliveryMode';

export function DeliveryModeControl({
  compact = false,
  disabled = false,
  idPrefix = 'delivery-mode',
  onChange = () => {},
  value,
}) {
  const selected = normalizeDeliveryMode(value);

  return (
    <div className={`delivery-mode-control ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Modo de entrega">
      {DELIVERY_MODE_OPTIONS.map((option) => {
        const id = `${idPrefix}-${option.value}`;
        return (
          <label className={`delivery-mode-option ${selected === option.value ? 'active' : ''}`} htmlFor={id} key={option.value}>
            <input
              checked={selected === option.value}
              disabled={disabled}
              id={id}
              name={idPrefix}
              type="radio"
              value={option.value}
              onChange={() => onChange(option.value)}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        );
      })}
    </div>
  );
}
