const DEFAULT_PAYER_DOMAIN = 'snapflow.app';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  const normalized = normalizeEmail(value);
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized);
}

function optionalEmail(value) {
  const normalized = normalizeEmail(value);
  return normalized && isValidEmail(normalized) ? normalized : '';
}

function fallbackPayerEmail(seed = '') {
  const localPart = String(seed || 'cliente')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'cliente';
  return `${localPart}@${DEFAULT_PAYER_DOMAIN}`;
}

function resolvePayerEmail(email, seed = '') {
  return optionalEmail(email) || fallbackPayerEmail(seed);
}

module.exports = {
  fallbackPayerEmail,
  isValidEmail,
  normalizeEmail,
  optionalEmail,
  resolvePayerEmail,
};
