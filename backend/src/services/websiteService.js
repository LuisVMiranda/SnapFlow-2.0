const { HttpError } = require('../errors');
const { validateClientPhone } = require('./phone');
const { coverUrl } = require('./galleryCoverService');

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.origin : '';
  } catch { return ''; }
}

function validateTypes(value, packages) {
  if (!Array.isArray(value) || !value.length || value.length > 12) {
    throw new HttpError(400, 'Selecione pelo menos um tipo de galeria.', 'website_types_required');
  }
  const types = [...new Set(value)];
  if (types.some((type) => typeof type !== 'string' || !Object.hasOwn(packages, type))) {
    throw new HttpError(400, 'Tipo de galeria desconhecido. Atualize os pacotes.', 'website_type_invalid');
  }
  return types;
}

function validateOrder(tokens) {
  if (!Array.isArray(tokens) || tokens.length > 10 || tokens.some((token) => typeof token !== 'string')) {
    throw new HttpError(400, 'Lista de galerias inválida.', 'website_order_invalid');
  }
  if (new Set(tokens).size !== tokens.length) throw new HttpError(400, 'A lista contém galerias repetidas.', 'website_order_invalid');
  return tokens;
}

function searchOptions(query, types) {
  const offset = Number(query.cursor || 0);
  const limit = Number(query.limit || 25);
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new HttpError(400, 'Paginação inválida.', 'website_page_invalid');
  }
  return { search: String(query.query || '').slice(0, 120), offset, limit, types };
}

function galleryPayload(row, baseUrl) {
  return { id: row.gallery_id, token: row.token, title: row.gallery_name,
    galleryUrl: baseUrl ? new URL(`/s/${encodeURIComponent(row.token)}`, baseUrl).href : '',
    coverUrl: row.version ? coverUrl(row.token, row.version, 'card') : '' };
}

function createWebsiteService({ config, repos, credentials, packages }) {
  async function settings() {
    const saved = await repos.getSettings();
    return saved.websiteSettings || { eligiblePackageTypes: ['eventos'] };
  }
  async function publicConfig() {
    const phone = validateClientPhone(await credentials.getSecretValue('photographerPhone'));
    const baseUrl = safeHttpUrl(await credentials.getSecretValue('publicBaseUrl') || config.publicBaseUrl);
    return { baseUrl, websiteUrl: safeHttpUrl(config.publicWebsiteUrl),
      contact: { enabled: phone.valid, phone: phone.valid ? phone.normalized : '',
        label: phone.valid ? phone.formatted : '' } };
  }
  async function get(admin = false) {
    const current = await settings();
    const resolved = await publicConfig();
    const rows = await repos.websiteCarousel(current.eligiblePackageTypes);
    const result = { contact: resolved.contact, galleries: rows.map((row) => galleryPayload(row, resolved.baseUrl)) };
    if (!admin) return result;
    return { ...result, settings: current, websiteUrl: resolved.websiteUrl,
      galleryBaseUrl: resolved.baseUrl, packages: await packages.getSettings() };
  }
  async function saveSettings(body) {
    const eligiblePackageTypes = validateTypes(body?.eligiblePackageTypes, await packages.getSettings());
    await repos.upsertSettings({ websiteSettings: { eligiblePackageTypes } });
    return get(true);
  }
  async function search(query) {
    const options = searchOptions(query, (await settings()).eligiblePackageTypes);
    const rows = await repos.searchWebsiteGalleries(options);
    const { baseUrl } = await publicConfig();
    return { items: rows.slice(0, options.limit).map((row) => ({ ...galleryPayload(row, baseUrl),
      eligible: row.eligible, state: row.state, packageType: row.package_type, expiresAt: row.expires_at })),
    nextCursor: rows.length > options.limit ? String(options.offset + options.limit) : null };
  }
  async function change(token, state) {
    if (!await repos.getShareSession(token)) throw new HttpError(404, 'Galeria não encontrada.', 'share_not_found');
    await repos.changeWebsiteEntry(token, state, (await settings()).eligiblePackageTypes);
    return get(true);
  }
  async function reorder(body) {
    await repos.reorderWebsite(validateOrder(body?.tokens), (await settings()).eligiblePackageTypes);
    return get(true);
  }
  return { get, saveSettings, search, change, reorder };
}
module.exports = { createWebsiteService, safeHttpUrl, validateTypes, validateOrder, searchOptions, galleryPayload };
