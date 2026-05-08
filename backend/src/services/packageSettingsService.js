const { HttpError } = require('../errors');

const DEFAULT_PACKAGE_OPTIONS = {
  eventos: {
    label: 'Pacote 5+ fotos',
    shortLabel: 'Eventos',
    description: 'R$ 15 por foto, cai para R$ 10 a partir de 5 fotos.',
    unit: 15,
    bulk: 10,
    threshold: 5,
  },
  escola: {
    label: 'Pacote 3+ fotos',
    shortLabel: 'Escola / Corp',
    description: 'R$ 15 por foto, cai para R$ 10 a partir de 3 fotos.',
    unit: 15,
    bulk: 10,
    threshold: 3,
  },
};

function parseSetting(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function slugify(value, fallback) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug || fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePackage(key, value) {
  const normalizedKey = slugify(key || value?.shortLabel || value?.label, 'pacote');
  const label = String(value?.label || value?.shortLabel || normalizedKey).trim().slice(0, 80);
  const shortLabel = String(value?.shortLabel || label).trim().slice(0, 40);
  const threshold = Math.max(1, Math.round(positiveNumber(value?.threshold, 1)));
  const unit = positiveNumber(value?.unit, 15);
  const bulk = positiveNumber(value?.bulk, unit);
  const description = String(
    value?.description || `R$ ${unit} por foto, cai para R$ ${bulk} a partir de ${threshold} fotos.`
  ).trim().slice(0, 180);

  return {
    key: normalizedKey,
    package: { label, shortLabel, description, unit, bulk, threshold },
  };
}

function normalizePackageOptions(value) {
  const source = parseSetting(value, DEFAULT_PACKAGE_OPTIONS);
  const entries = Object.entries(source || {}).slice(0, 12);
  const normalized = {};

  for (const [key, packageValue] of entries) {
    const result = normalizePackage(key, packageValue);
    normalized[result.key] = result.package;
  }

  return Object.keys(normalized).length ? normalized : DEFAULT_PACKAGE_OPTIONS;
}

function createPackageSettingsService({ repos }) {
  async function getSettings() {
    const raw = await repos.getSettings();
    return normalizePackageOptions(raw.packageOptions);
  }

  async function updateSettings(packageOptions) {
    const normalized = normalizePackageOptions(packageOptions);
    if (!Object.keys(normalized).length) {
      throw new HttpError(400, 'Mantenha ao menos uma opção de pacote ativa para que o cliente consiga finalizar pedidos.', 'package_options_required');
    }
    await repos.upsertSettings({ packageOptions: normalized });
    return getSettings();
  }

  return { getSettings, updateSettings };
}

module.exports = {
  DEFAULT_PACKAGE_OPTIONS,
  createPackageSettingsService,
  normalizePackageOptions,
};
