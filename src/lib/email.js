export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateOptionalEmail(value) {
  const normalized = normalizeEmail(value);
  if (!normalized) {
    return {
      valid: true,
      normalized: '',
      message: 'E-mail opcional para o Pix. Se preferir, deixe em branco.',
      tone: 'muted',
    };
  }

  const valid = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized);
  return valid
    ? {
        valid: true,
        normalized,
        message: `E-mail confirmado para o pagamento: ${normalized}`,
        tone: 'success',
      }
    : {
        valid: false,
        normalized,
        message: 'Informe um e-mail valido ou deixe este campo em branco.',
        tone: 'danger',
      };
}
