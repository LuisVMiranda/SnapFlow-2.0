const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { HttpError } = require('../errors');

function coverUrl(token, version, variant = 'access') {
  return `/api/website/gallery-covers/${encodeURIComponent(token)}/${variant}?v=${encodeURIComponent(version)}`;
}

async function sendCoverFile(res, filePath) {
  try {
    await new Promise((resolve, reject) => res.sendFile(filePath, (error) => error ? reject(error) : resolve()));
  } catch (error) {
    if (res.headersSent) throw error;
    res.set('Cache-Control', 'no-store');
    res.removeHeader('Content-Type');
    if (error.status === 404) throw new HttpError(404, 'Capa não encontrada.', 'cover_not_found');
    throw error;
  }
}

function createGalleryCoverService({ config, repos }) {
  const storageRoot = config.storageRoot || path.join(__dirname, '../../storage');
  const directory = path.resolve(storageRoot, 'gallery-covers');
  function absolute(relative) {
    const resolved = path.resolve(storageRoot, relative);
    if (!resolved.startsWith(`${directory}${path.sep}`)) throw new Error('Caminho de capa inválido.');
    return resolved;
  }
  async function cleanup(cover) {
    if (!cover) return;
    for (const file of [cover.card_path, cover.access_path]) {
      await fs.unlink(absolute(file)).catch((error) => {
        if (error.code !== 'ENOENT') console.warn(`Capa órfã pendente de limpeza: ${file}: ${error.message}`);
      });
    }
  }
  async function process(file) {
    const version = crypto.randomBytes(16).toString('hex');
    const cover = { version, card_path: `gallery-covers/${version}-card.webp`,
      access_path: `gallery-covers/${version}-access.webp`, original_filename: path.basename(file.originalname) };
    try {
      await fs.mkdir(directory, { recursive: true });
      const input = sharp(file.path, { limitInputPixels: 60000000, animated: false }).rotate();
      const result = await input.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 }).toFile(absolute(cover.access_path));
      await input.clone().resize(800, 1200, { fit: 'cover', position: 'centre' })
        .webp({ quality: 80 }).toFile(absolute(cover.card_path));
      return { ...cover, width: result.width, height: result.height };
    } catch (error) {
      await cleanup(cover);
      throw new HttpError(400, 'Não foi possível processar a capa. Envie uma imagem válida de até 60 megapixels.', 'cover_invalid', { reason: error.message });
    } finally {
      await fs.unlink(file.path).catch((error) => console.warn(`Falha ao limpar upload de capa: ${error.message}`));
    }
  }
  async function upload(token, file) {
    const cover = await process(file);
    let old;
    try { old = await repos.replaceGalleryCover(token, cover); }
    catch (error) { await cleanup(cover); throw error; }
    await cleanup(old);
    return { coverUrl: coverUrl(token, cover.version), cardUrl: coverUrl(token, cover.version, 'card') };
  }
  async function remove(token, removeEntry = false) {
    await cleanup(await repos.removeGalleryCover(token, removeEntry));
  }
  async function send(token, variant, res) {
    if (!['card', 'access'].includes(variant)) throw new HttpError(404, 'Capa não encontrada.', 'cover_not_found');
    const cover = await repos.getGalleryCover(token);
    if (!cover) throw new HttpError(404, 'Capa não encontrada.', 'cover_not_found');
    res.set({ 'Cache-Control': 'public, max-age=60, must-revalidate',
      'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff' });
    await sendCoverFile(res, absolute(cover[`${variant}_path`]));
  }
  return { upload, remove, send };
}
module.exports = { coverUrl, createGalleryCoverService };
