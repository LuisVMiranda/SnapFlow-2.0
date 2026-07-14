const { HttpError } = require('../errors');

const DELIVERY_MODES = Object.freeze({
  WHATSAPP: 'whatsapp',
  DOWNLOAD: 'download',
  BOTH: 'both',
});

const DEFAULT_DELIVERY_MODE = DELIVERY_MODES.DOWNLOAD;
const LEGACY_DELIVERY_MODE = DELIVERY_MODES.WHATSAPP;
const DEFAULT_POST_PAYMENT_ACCESS_DAYS = 7;
const MIN_POST_PAYMENT_ACCESS_DAYS = 1;
const MAX_POST_PAYMENT_ACCESS_DAYS = 365;

function normalizeDeliveryMode(value, fallback = DEFAULT_DELIVERY_MODE) {
  const mode = String(value || '').trim().toLowerCase();
  return Object.values(DELIVERY_MODES).includes(mode) ? mode : fallback;
}

function allowsGalleryDownload(mode) {
  return [DELIVERY_MODES.DOWNLOAD, DELIVERY_MODES.BOTH].includes(normalizeDeliveryMode(mode, LEGACY_DELIVERY_MODE));
}

function allowsWhatsappDelivery(mode) {
  return [DELIVERY_MODES.WHATSAPP, DELIVERY_MODES.BOTH].includes(normalizeDeliveryMode(mode, LEGACY_DELIVERY_MODE));
}

function deliveryModeForOriginals(sendOriginalsViaWhatsapp) {
  return sendOriginalsViaWhatsapp === true ? DELIVERY_MODES.BOTH : DELIVERY_MODES.DOWNLOAD;
}

function sendsOriginalsViaWhatsapp(mode) {
  return allowsWhatsappDelivery(mode);
}

function numberOrNaN(value) {
  try {
    return Number(value);
  } catch {
    return Number.NaN;
  }
}

function normalizePostPaymentAccessDays(value, fallback = DEFAULT_POST_PAYMENT_ACCESS_DAYS) {
  const parsed = numberOrNaN(value);
  if (!Number.isInteger(parsed)) return fallback;
  if (parsed < MIN_POST_PAYMENT_ACCESS_DAYS || parsed > MAX_POST_PAYMENT_ACCESS_DAYS) return fallback;
  return parsed;
}

function validatePostPaymentAccessDays(value) {
  const parsed = numberOrNaN(value);
  if (!Number.isInteger(parsed) || parsed < MIN_POST_PAYMENT_ACCESS_DAYS || parsed > MAX_POST_PAYMENT_ACCESS_DAYS) {
    throw new HttpError(
      400,
      `Informe um prazo após o pagamento entre ${MIN_POST_PAYMENT_ACCESS_DAYS} e ${MAX_POST_PAYMENT_ACCESS_DAYS} dias.`,
      'post_payment_access_days_invalid'
    );
  }
  return parsed;
}

function settingsFromRaw(raw = {}) {
  const defaultSendOriginalsViaWhatsapp = raw.defaultSendOriginalsViaWhatsapp === undefined
    ? (raw.defaultDeliveryMode === undefined ? false : sendsOriginalsViaWhatsapp(raw.defaultDeliveryMode))
    : raw.defaultSendOriginalsViaWhatsapp === true;
  return {
    defaultDeliveryMode: deliveryModeForOriginals(defaultSendOriginalsViaWhatsapp),
    defaultPostPaymentAccessDays: normalizePostPaymentAccessDays(raw.defaultPostPaymentAccessDays),
    defaultSendOriginalsViaWhatsapp,
  };
}

function createDeliveryModeSettingsService({ repos }) {
  async function getSettings() {
    if (typeof repos.getSettings !== 'function') {
      return settingsFromRaw();
    }
    return settingsFromRaw(await repos.getSettings());
  }

  async function updateSettings(settings = {}) {
    const current = await getSettings();
    const defaultSendOriginalsViaWhatsapp = settings.defaultSendOriginalsViaWhatsapp === undefined
      ? sendsOriginalsViaWhatsapp(settings.defaultDeliveryMode ?? current.defaultDeliveryMode)
      : settings.defaultSendOriginalsViaWhatsapp === true;
    const defaultPostPaymentAccessDays = settings.defaultPostPaymentAccessDays === undefined
      ? current.defaultPostPaymentAccessDays
      : validatePostPaymentAccessDays(settings.defaultPostPaymentAccessDays);
    const normalized = {
      defaultDeliveryMode: deliveryModeForOriginals(defaultSendOriginalsViaWhatsapp),
      defaultPostPaymentAccessDays,
      defaultSendOriginalsViaWhatsapp,
    };
    if (typeof repos.upsertSettings !== 'function') {
      return normalized;
    }
    await repos.upsertSettings(normalized);
    return getSettings();
  }

  return { getSettings, updateSettings };
}

module.exports = {
  DEFAULT_POST_PAYMENT_ACCESS_DAYS,
  DEFAULT_DELIVERY_MODE,
  DELIVERY_MODES,
  LEGACY_DELIVERY_MODE,
  MAX_POST_PAYMENT_ACCESS_DAYS,
  MIN_POST_PAYMENT_ACCESS_DAYS,
  allowsGalleryDownload,
  allowsWhatsappDelivery,
  createDeliveryModeSettingsService,
  deliveryModeForOriginals,
  normalizeDeliveryMode,
  normalizePostPaymentAccessDays,
  sendsOriginalsViaWhatsapp,
  validatePostPaymentAccessDays,
};
