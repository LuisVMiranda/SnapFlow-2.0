const crypto = require('crypto');
const { HttpError } = require('../errors');
const { safeEqual } = require('../auth');

const CREDENTIAL_DEFINITIONS = {
  mpAccessToken: { label: 'Token de acesso Mercado Pago', group: 'api', sensitive: true, envName: 'MP_ACCESS_TOKEN' },
  mpWebhookSecret: { label: 'Segredo de webhook Mercado Pago', group: 'api', sensitive: true, envName: 'MP_WEBHOOK_SECRET' },
  publicBaseUrl: { label: 'URL pública', group: 'api', sensitive: false, envName: 'PUBLIC_BASE_URL' },
  photographerName: { label: 'Nome do fotógrafo', group: 'profile', sensitive: false },
  studioName: { label: 'Estúdio ou marca', group: 'profile', sensitive: false },
  photographerPhone: { label: 'Telefone comercial', group: 'profile', sensitive: false },
  businessContact: { label: 'Contato comercial', group: 'profile', sensitive: false },
  pixDisplayInfo: { label: 'Dados Pix para exibição', group: 'profile', sensitive: false },
};

function encryptionKey(secret) {
  return crypto.createHash('sha256').update(String(secret || '')).digest();
}

function encryptValue(value, secret) {
  if (!secret) throw new HttpError(500, 'CREDENTIALS_SECRET ausente para salvar dados sensíveis.', 'credentials_secret_missing');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptValue(value, secret) {
  if (!value) return '';
  if (!value.startsWith('enc:v1:')) return value;
  if (!secret) return '';
  const [, , iv, tag, encrypted] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function maskValue(value) {
  const clean = String(value || '');
  if (!clean) return '';
  const last4 = clean.slice(-4);
  return `${'•'.repeat(Math.max(4, Math.min(8, clean.length - last4.length)))}${last4}`;
}

function normalizeKey(key) {
  const safeKey = String(key || '').trim();
  if (!Object.prototype.hasOwnProperty.call(CREDENTIAL_DEFINITIONS, safeKey)) {
    throw new HttpError(404, 'Credencial não encontrada.', 'credential_not_found');
  }
  return safeKey;
}

function createCredentialsService({ config, repos }) {
  function confirmCredential(value) {
    if (!safeEqual(String(value || ''), config.adminAccessToken)) {
      throw new HttpError(401, 'Confirmação administrativa inválida.', 'credential_confirmation_invalid');
    }
  }

  function readRawValue(record, definition) {
    if (record) return definition.sensitive ? decryptValue(record.value, config.credentialsSecret) : record.value;
    return definition.envName ? process.env[definition.envName] || '' : '';
  }

  function publicCredential(key, record = null) {
    const definition = CREDENTIAL_DEFINITIONS[key];
    const value = readRawValue(record, definition);
    return {
      key,
      label: definition.label,
      group: definition.group,
      sensitive: definition.sensitive,
      configured: Boolean(value),
      maskedValue: definition.sensitive ? maskValue(value) : value,
      updatedAt: record?.updated_at || null,
      source: record ? 'database' : definition.envName ? 'ambiente' : 'vazio',
    };
  }

  async function listCredentials() {
    const records = new Map((await repos.listCredentials()).map((record) => [record.key, record]));
    const items = Object.keys(CREDENTIAL_DEFINITIONS).map((key) => publicCredential(key, records.get(key)));
    return {
      api: items.filter((item) => item.group === 'api'),
      profile: items.filter((item) => item.group === 'profile'),
    };
  }

  async function getSecretValue(key) {
    const safeKey = normalizeKey(key);
    const definition = CREDENTIAL_DEFINITIONS[safeKey];
    const record = await repos.getCredential(safeKey);
    return readRawValue(record, definition);
  }

  async function updateCredential(key, body = {}) {
    const safeKey = normalizeKey(key);
    const definition = CREDENTIAL_DEFINITIONS[safeKey];
    confirmCredential(body.confirmation);
    const value = String(body.value || '').trim();
    if (!value) throw new HttpError(400, 'Informe um valor para salvar.', 'credential_value_required');
    const storedValue = definition.sensitive ? encryptValue(value, config.credentialsSecret) : value;
    const record = await repos.upsertCredential({ key: safeKey, value: storedValue, sensitive: definition.sensitive });
    return publicCredential(safeKey, record);
  }

  async function deleteCredential(key, body = {}) {
    const safeKey = normalizeKey(key);
    confirmCredential(body.confirmation);
    await repos.deleteCredential(safeKey);
    return publicCredential(safeKey, null);
  }

  return {
    deleteCredential,
    getSecretValue,
    listCredentials,
    updateCredential,
  };
}

module.exports = { CREDENTIAL_DEFINITIONS, createCredentialsService };
