export const DELIVERY_MODES = {
  WHATSAPP: 'whatsapp',
  DOWNLOAD: 'download',
  BOTH: 'both',
};

export const DEFAULT_DELIVERY_MODE = DELIVERY_MODES.BOTH;

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
