export const DELIVERY_MODES = {
  WHATSAPP: 'whatsapp',
  DOWNLOAD: 'download',
  BOTH: 'both',
};

export const DEFAULT_DELIVERY_MODE = DELIVERY_MODES.DOWNLOAD;
export const DEFAULT_POST_PAYMENT_ACCESS_DAYS = 7;

export const DELIVERY_MODE_OPTIONS = [
  {
    value: DELIVERY_MODES.BOTH,
    label: 'Ambos',
    description: 'WhatsApp e download na galeria.',
  },
  {
    value: DELIVERY_MODES.WHATSAPP,
    label: 'WhatsApp',
    description: 'Entrega principal pelo WhatsApp.',
  },
  {
    value: DELIVERY_MODES.DOWNLOAD,
    label: 'Download',
    description: 'Liberação apenas na galeria.',
  },
];

export function normalizeDeliveryMode(value, fallback = DEFAULT_DELIVERY_MODE) {
  return DELIVERY_MODE_OPTIONS.some((option) => option.value === value) ? value : fallback;
}

export function deliveryModeLabel(value) {
  const normalized = normalizeDeliveryMode(value);
  return DELIVERY_MODE_OPTIONS.find((option) => option.value === normalized)?.label || 'Ambos';
}

export function deliveryModeForOriginals(sendOriginalsViaWhatsapp) {
  return sendOriginalsViaWhatsapp === true ? DELIVERY_MODES.BOTH : DELIVERY_MODES.DOWNLOAD;
}

export function sendsOriginalsViaWhatsapp(value) {
  return normalizeDeliveryMode(value, DELIVERY_MODES.WHATSAPP) !== DELIVERY_MODES.DOWNLOAD;
}

function numberOrNaN(value) {
  try {
    return Number(value);
  } catch {
    return Number.NaN;
  }
}

export function normalizePostPaymentAccessDays(value, fallback = DEFAULT_POST_PAYMENT_ACCESS_DAYS) {
  const parsed = numberOrNaN(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 365 ? parsed : fallback;
}

export function galleryDeliveryPayload(options = {}) {
  return {
    ...(options.deliveryMode ? { deliveryMode: options.deliveryMode } : {}),
    ...(options.postPaymentAccessDays ? { postPaymentAccessDays: options.postPaymentAccessDays } : {}),
    ...(options.sendOriginalsViaWhatsapp !== undefined
      ? { sendOriginalsViaWhatsapp: options.sendOriginalsViaWhatsapp }
      : {}),
  };
}
