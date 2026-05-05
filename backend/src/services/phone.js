function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function localBrazilDigits(value) {
  const digits = digitsOnly(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

function normalizeBrazilPhone(phone) {
  const local = localBrazilDigits(phone);
  if (local.length === 10 || local.length === 11) return `55${local}`;
  return digitsOnly(phone);
}

function formatBrazilPhone(phone) {
  const local = localBrazilDigits(phone);
  if (local.length === 11) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digitsOnly(phone);
}

function validateBrazilPhone(phone) {
  const raw = digitsOnly(phone);
  const local = localBrazilDigits(phone);
  if (!raw) {
    return { valid: false, code: 'phone_required', message: 'Informe o WhatsApp do cliente.' };
  }
  if (local.length !== 10 && local.length !== 11) {
    return {
      valid: false,
      code: 'phone_invalid_length',
      message: 'Informe um WhatsApp brasileiro com DDD e 10 ou 11 dígitos.',
    };
  }
  const ddd = Number(local.slice(0, 2));
  if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) {
    return { valid: false, code: 'phone_invalid_ddd', message: 'Informe um DDD brasileiro válido.' };
  }
  if (local.length === 11 && local[2] !== '9') {
    return {
      valid: false,
      code: 'phone_invalid_mobile',
      message: 'Celulares brasileiros com 11 dígitos devem ter 9 depois do DDD.',
    };
  }
  return {
    valid: true,
    code: 'phone_valid',
    local,
    normalized: `55${local}`,
    formatted: formatBrazilPhone(local),
  };
}

module.exports = { digitsOnly, formatBrazilPhone, normalizeBrazilPhone, validateBrazilPhone };
