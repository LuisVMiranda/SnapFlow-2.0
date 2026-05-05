export function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function localBrazilPhoneDigits(value) {
  const digits = phoneDigits(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

export function formatBrazilPhone(value) {
  const local = localBrazilPhoneDigits(value);
  if (local.length === 11) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phoneDigits(value);
}

export function validateBrazilPhone(value) {
  const raw = phoneDigits(value);
  const local = localBrazilPhoneDigits(value);
  if (!raw) return { valid: false, message: 'Informe o WhatsApp do cliente.' };
  if (local.length !== 10 && local.length !== 11) {
    return { valid: false, message: 'Use DDD + número com 10 ou 11 dígitos.' };
  }
  const ddd = Number(local.slice(0, 2));
  if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) {
    return { valid: false, message: 'Confira o DDD brasileiro do cliente.' };
  }
  if (local.length === 11 && local[2] !== '9') {
    return { valid: false, message: 'Celular com 11 dígitos deve ter 9 depois do DDD.' };
  }
  return { valid: true, normalized: `55${local}`, formatted: formatBrazilPhone(local) };
}
