import { useEffect, useState } from 'react';
import { deliveryModeForOriginals, normalizePostPaymentAccessDays, sendsOriginalsViaWhatsapp } from '../lib/deliveryMode';

export function GalleryDeliveryControl({
  disabled = false,
  idPrefix = 'gallery-delivery',
  mode,
  onAccessDaysChange = () => {},
  onModeChange = () => {},
  postPaymentAccessDays = 7,
}) {
  const sendOriginals = sendsOriginalsViaWhatsapp(mode);
  const [daysDraft, setDaysDraft] = useState(String(postPaymentAccessDays));
  const toggleId = `${idPrefix}-whatsapp-originals`;
  const daysId = `${idPrefix}-access-days`;

  useEffect(() => {
    setDaysDraft(String(postPaymentAccessDays));
  }, [postPaymentAccessDays]);

  const updateDaysDraft = (value) => {
    setDaysDraft(value);
  };

  const commitDaysDraft = () => {
    const normalized = normalizePostPaymentAccessDays(daysDraft, postPaymentAccessDays);
    setDaysDraft(String(normalized));
    onAccessDaysChange(normalized);
  };

  return (
    <div className="gallery-delivery-control">
      <label className="gallery-delivery-toggle" htmlFor={toggleId}>
        <input
          checked={sendOriginals}
          disabled={disabled}
          id={toggleId}
          type="checkbox"
          onChange={(event) => onModeChange(deliveryModeForOriginals(event.target.checked))}
        />
        <span>Enviar também os originais pelo WhatsApp</span>
      </label>
      <small className="summary-help">
        {sendOriginals
          ? 'O cliente poderá baixar na galeria e receberá os arquivos também pelo WhatsApp.'
          : 'O cliente receberá um aviso pelo WhatsApp e fará o download pela galeria.'}
      </small>
      <label className="gallery-delivery-days" htmlFor={daysId}>
        <span>Acesso para download após o pagamento</span>
        <span className="gallery-delivery-days-input">
          <input
            className="phone-input"
            disabled={disabled}
            id={daysId}
            max="365"
            min="1"
            type="number"
            value={daysDraft}
            onBlur={commitDaysDraft}
            onChange={(event) => updateDaysDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitDaysDraft();
              }
            }}
          />
          <span>dias</span>
        </span>
      </label>
    </div>
  );
}
