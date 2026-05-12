export const DEFAULT_COUNTRY_CODE = '55';

export function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeCountryCode(value, fallback = DEFAULT_COUNTRY_CODE) {
  const digits = phoneDigits(value).slice(0, 4);
  return digits || fallback;
}

export function buildStoredPhone({ countryCode = DEFAULT_COUNTRY_CODE, localNumber = '' } = {}) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const normalizedLocalNumber = phoneDigits(localNumber).slice(0, 14);
  if (!normalizedLocalNumber) return `+${normalizedCountryCode}`;
  return `+${normalizedCountryCode} ${normalizedLocalNumber}`;
}

export function splitStoredPhone(value, fallbackCountryCode = DEFAULT_COUNTRY_CODE) {
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
    const localNumber = phoneDigits(explicitMatch[2]).slice(0, 14);
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

  const digits = phoneDigits(raw);
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

export function formatBrazilPhone(value) {
  const local = phoneDigits(value);
  if (local.length === 11) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `+55 ${local}`.trim();
}

export function formatClientPhone(value) {
  const parts = typeof value === 'string' ? splitStoredPhone(value) : value || {};
  const countryCode = normalizeCountryCode(parts.countryCode);
  const localNumber = phoneDigits(parts.localNumber).slice(0, 14);
  if (!localNumber) return '';
  if (countryCode === DEFAULT_COUNTRY_CODE) return formatBrazilPhone(localNumber);
  return `+${countryCode} ${localNumber}`;
}

export function validateClientPhone({ countryCode, localNumber }) {
  const normalizedCountryCode = phoneDigits(countryCode);
  const normalizedLocalNumber = phoneDigits(localNumber);

  if (!normalizedLocalNumber) {
    return { valid: false, code: 'phone_required', message: 'Informe o WhatsApp do cliente antes de continuar.' };
  }

  if (!normalizedCountryCode || normalizedCountryCode.length > 4) {
    return {
      valid: false,
      code: 'phone_invalid_country_code',
      message: 'Informe um DDI valido com ate 4 digitos. Exemplo: 55 para Brasil ou 54 para Argentina.',
    };
  }

  if (normalizedCountryCode === DEFAULT_COUNTRY_CODE) {
    if (normalizedLocalNumber.length !== 10 && normalizedLocalNumber.length !== 11) {
      return {
        valid: false,
        code: 'phone_invalid_length',
        message: 'Para o Brasil, informe DDD + numero com 10 ou 11 digitos.',
      };
    }
    const ddd = Number(normalizedLocalNumber.slice(0, 2));
    if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) {
      return {
        valid: false,
        code: 'phone_invalid_ddd',
        message: 'Confira o DDD brasileiro do cliente. Exemplo valido: 21 97519-1926.',
      };
    }
    if (normalizedLocalNumber.length === 11 && normalizedLocalNumber[2] !== '9') {
      return {
        valid: false,
        code: 'phone_invalid_mobile',
        message: 'Celulares brasileiros com 11 digitos devem ter 9 logo apos o DDD.',
      };
    }
  } else if (normalizedLocalNumber.length < 6 || normalizedLocalNumber.length > 14) {
    return {
      valid: false,
      code: 'phone_invalid_length',
      message: 'Para numeros internacionais, informe entre 6 e 14 digitos no numero local alem do DDI.',
    };
  }

  const normalized = `${normalizedCountryCode}${normalizedLocalNumber}`;
  if (normalized.length > 15) {
    return {
      valid: false,
      code: 'phone_invalid_length',
      message: 'O WhatsApp aceita ate 15 digitos somando DDI e numero. Revise os campos e tente novamente.',
    };
  }

  const stored = buildStoredPhone({
    countryCode: normalizedCountryCode,
    localNumber: normalizedLocalNumber,
  });

  return {
    valid: true,
    code: 'phone_valid',
    countryCode: normalizedCountryCode,
    localNumber: normalizedLocalNumber,
    normalized,
    stored,
    formatted: formatClientPhone({ countryCode: normalizedCountryCode, localNumber: normalizedLocalNumber }),
  };
}

export function validateBrazilPhone(value) {
  const parts = splitStoredPhone(value, DEFAULT_COUNTRY_CODE);
  return validateClientPhone(parts);
}
