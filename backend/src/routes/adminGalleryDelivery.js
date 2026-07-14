const { HttpError } = require('../errors');
const {
  DEFAULT_DELIVERY_MODE,
  deliveryModeForOriginals,
  normalizeDeliveryMode,
  validatePostPaymentAccessDays,
} = require('../services/deliveryModeService');
const { normalizeShareExpiresMinutes } = require('../services/shareExpiration');

async function galleryDeliveryFromBody(body = {}, settingsService) {
  const settings = settingsService?.getSettings
    ? await settingsService.getSettings()
    : { defaultDeliveryMode: DEFAULT_DELIVERY_MODE, defaultPostPaymentAccessDays: 7 };
  const deliveryMode = body.sendOriginalsViaWhatsapp !== undefined
    ? deliveryModeForOriginals(body.sendOriginalsViaWhatsapp === true)
    : normalizeDeliveryMode(body.deliveryMode, settings.defaultDeliveryMode);
  const postPaymentAccessDays = body.postPaymentAccessDays === undefined
    ? validatePostPaymentAccessDays(settings.defaultPostPaymentAccessDays)
    : validatePostPaymentAccessDays(body.postPaymentAccessDays);
  return { deliveryMode, postPaymentAccessDays };
}

function editedExpiryFromBody(body = {}) {
  if (body.expiresAt !== undefined && String(body.expiresAt || '').trim()) {
    const expiresAt = new Date(body.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new HttpError(400, 'Informe uma data futura válida para o acesso atual da galeria.', 'share_expiry_invalid');
    }
    return expiresAt;
  }
  const minutes = Number(body.expiresMinutes);
  return Number.isFinite(minutes) && minutes > 0
    ? new Date(Date.now() + normalizeShareExpiresMinutes(minutes) * 60 * 1000)
    : null;
}

function validatePostPaymentDaysForExtension(value) {
  return validatePostPaymentAccessDays(value);
}

module.exports = { editedExpiryFromBody, galleryDeliveryFromBody, validatePostPaymentDaysForExtension };
