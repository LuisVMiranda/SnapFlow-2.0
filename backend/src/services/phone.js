const DEFAULT_COUNTRY_CODE = '55';

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCountryCode(value, fallback = DEFAULT_COUNTRY_CODE) {
  const digits = digitsOnly(value).slice(0, 4);
  return digits || fallback;
}

function buildStoredPhone({ countryCode = DEFAULT_COUNTRY_CODE, localNumber = '' } = {}) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const normalizedLocalNumber = digitsOnly(localNumber).slice(0, 14);
  if (!normalizedLocalNumber) return `+${normalizedCountryCode}`;
  return `+${normalizedCountryCode} ${normalizedLocalNumber}`;
}

function splitStoredPhone(value, fallbackCountryCode = DEFAULT_COUNTRY_CODE) {
  const raw = String(value || '').trim();
  if (!raw) {
    return {
      countryCode: fallbackCountryCode,
      localNumber: '',
      stored: '',
    };
  }

  const explicitMatch = raw.match(/^\+?(\d{1,4})[\s/-]+(.+)$/);
  if (explicitMatch) {
    const countryCode = normalizeCountryCode(explicitMatch[1], fallbackCountryCode);
    const localNumber = digitsOnly(explicitMatch[2]).slice(0, 14);
    return {
      countryCode,
      localNumber,
      stored: buildStoredPhone({ countryCode, localNumber }),
    };
  }

  const countryOnlyMatch = raw.match(/^\+?(\d{1,4})$/);
  if (countryOnlyMatch) {
    const countryCode = normalizeCountryCode(countryOnlyMatch[1], fallbackCountryCode);
    return {
      countryCode,
      localNumber: '',
      stored: `+${countryCode}`,
    };
  }

  const digits = digitsOnly(raw);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    const localNumber = digits.slice(2);
    return {
      countryCode: DEFAULT_COUNTRY_CODE,
      localNumber,
      stored: buildStoredPhone({ countryCode: DEFAULT_COUNTRY_CODE, localNumber }),
    };
  }

  return {
    countryCode: fallbackCountryCode,
    localNumber: digits.slice(0, 14),
    stored: buildStoredPhone({ countryCode: fallbackCountryCode, localNumber: digits.slice(0, 14) }),
  };
}

function formatBrazilPhone(phone) {
  const local = digitsOnly(phone);
  if (local.length === 11) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `+55 ${local}`.trim();
}

function formatClientPhone(value) {
  const parts = typeof value === 'string' ? splitStoredPhone(value) : value || {};
  const countryCode = normalizeCountryCode(parts.countryCode);
  const localNumber = digitsOnly(parts.localNumber).slice(0, 14);
  if (!localNumber) return '';
  if (countryCode === DEFAULT_COUNTRY_CODE) return formatBrazilPhone(localNumber);
  return `+${countryCode} ${localNumber}`;
}

function validateClientPhone(phone) {
  const parts = typeof phone === 'string' ? splitStoredPhone(phone) : phone || {};
  const countryCode = digitsOnly(parts.countryCode);
  const localNumber = digitsOnly(parts.localNumber);

  if (!localNumber) {
    return { valid: false, code: 'phone_required', message: 'Informe o WhatsApp do cliente antes de continuar.' };
  }

  if (!countryCode || countryCode.length > 4) {
    return {
      valid: false,
      code: 'phone_invalid_country_code',
      message: 'Informe um DDI valido com ate 4 digitos. Exemplo: 55 para Brasil ou 54 para Argentina.',
    };
  }

  if (countryCode === DEFAULT_COUNTRY_CODE) {
    if (localNumber.length !== 10 && localNumber.length !== 11) {
      return {
        valid: false,
        code: 'phone_invalid_length',
        message: 'Para o Brasil, informe DDD + numero com 10 ou 11 digitos. Exemplo: 21975191926.',
      };
    }
    const ddd = Number(localNumber.slice(0, 2));
    if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) {
      return {
        valid: false,
        code: 'phone_invalid_ddd',
        message: 'Informe um DDD brasileiro valido. Exemplo: 21 97519-1926.',
      };
    }
    if (localNumber.length === 11 && localNumber[2] !== '9') {
      return {
        valid: false,
        code: 'phone_invalid_mobile',
        message: 'Celulares brasileiros com 11 digitos devem ter 9 logo apos o DDD. Confira o numero antes de enviar pelo WhatsApp.',
      };
    }
  } else if (localNumber.length < 6 || localNumber.length > 14) {
    return {
      valid: false,
      code: 'phone_invalid_length',
      message: 'Para numeros internacionais, informe entre 6 e 14 digitos no numero local alem do DDI.',
    };
  }

  const normalized = `${countryCode}${localNumber}`;
  if (normalized.length > 15) {
    return {
      valid: false,
      code: 'phone_invalid_length',
      message: 'O WhatsApp aceita ate 15 digitos somando DDI e numero. Revise os campos e tente novamente.',
    };
  }

  return {
    valid: true,
    code: 'phone_valid',
    countryCode,
    localNumber,
    normalized,
    stored: buildStoredPhone({ countryCode, localNumber }),
    formatted: formatClientPhone({ countryCode, localNumber }),
  };
}

function normalizeClientPhone(phone) {
  const validation = validateClientPhone(phone);
  return validation.valid ? validation.normalized : digitsOnly(typeof phone === 'string' ? phone : buildStoredPhone(phone));
}

function normalizeBrazilPhone(phone) {
  const parts = splitStoredPhone(phone, DEFAULT_COUNTRY_CODE);
  return normalizeClientPhone({
    countryCode: DEFAULT_COUNTRY_CODE,
    localNumber: parts.localNumber,
  });
}

function validateBrazilPhone(phone) {
  const parts = splitStoredPhone(phone, DEFAULT_COUNTRY_CODE);
  return validateClientPhone({
    countryCode: DEFAULT_COUNTRY_CODE,
    localNumber: parts.localNumber,
  });
}

module.exports = {
  DEFAULT_COUNTRY_CODE,
  buildStoredPhone,
  digitsOnly,
  formatBrazilPhone,
  formatClientPhone,
  normalizeBrazilPhone,
  normalizeClientPhone,
  normalizeCountryCode,
  splitStoredPhone,
  validateBrazilPhone,
  validateClientPhone,
};
