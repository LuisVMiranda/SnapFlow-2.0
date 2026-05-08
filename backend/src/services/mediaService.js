const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { randomToken } = require('../tokens');
const { HttpError } = require('../errors');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function safeRelativePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new HttpError(400, 'Caminho de arquivo inválido. Use apenas arquivos dentro da pasta privada de armazenamento do SnapFlow.', 'invalid_file_path');
  }
  return normalized;
}

function createMediaService(config) {
  const dirs = {
    originals: path.join(config.storageRoot, 'originals'),
    thumbs: path.join(config.storageRoot, 'thumbs'),
    previews: path.join(config.storageRoot, 'previews'),
    temp: path.join(config.storageRoot, 'tmp'),
    archive: path.join(config.storageRoot, 'archive'),
  };

  async function ensureStorage() {
    await Promise.all(Object.values(dirs).map((dir) => fs.mkdir(dir, { recursive: true })));
  }

  function absolutePath(relativePath) {
    const safe = safeRelativePath(relativePath);
    return path.join(config.storageRoot, safe);
  }

  function tempDir() {
    return dirs.temp;
  }

  function validateUploadFile(file) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new HttpError(400, 'Tipo de arquivo não permitido. Envie fotos em JPG, PNG ou WebP.', 'invalid_file_type');
    }
  }

  async function checksumFile(filePath) {
    const hash = crypto.createHash('sha256');
    const content = await fs.readFile(filePath);
    hash.update(content);
    return hash.digest('hex');
  }

  function watermarkSvg(width = 960, height = 640) {
    return Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          text { font-family: Arial, sans-serif; font-weight: 700; }
        </style>
        <rect width="100%" height="100%" fill="transparent"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
          font-size="48" fill="rgba(255,255,255,0.65)" stroke="rgba(0,0,0,0.75)"
          stroke-width="2" transform="rotate(-35 ${width / 2} ${height / 2})">
          SNAPFLOW PREVIEW
        </text>
      </svg>
    `);
  }

  async function processUploadedFiles(files, retentionExpiresAt = null) {
    await ensureStorage();
    const processed = [];

    for (const file of files) {
      validateUploadFile(file);
      const id = `photo_${randomToken(12)}`;
      const originalRel = `originals/${id}.jpg`;
      const thumbRel = `thumbs/${id}.jpg`;
      const previewRel = `previews/${id}.jpg`;
      const originalAbs = absolutePath(originalRel);
      const thumbAbs = absolutePath(thumbRel);
      const previewAbs = absolutePath(previewRel);

      try {
        await sharp(file.path).rotate().jpeg({ quality: 94 }).toFile(originalAbs);
        await sharp(originalAbs).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(thumbAbs);
        const preview = await sharp(originalAbs)
          .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
          .toBuffer({ resolveWithObject: true });
        await sharp(preview.data)
          .composite([{ input: watermarkSvg(preview.info.width, preview.info.height), gravity: 'center' }])
          .jpeg({ quality: 72 })
          .toFile(previewAbs);

        const stat = await fs.stat(originalAbs);
        processed.push({
          id,
          originalPath: originalRel,
          thumbPath: thumbRel,
          previewPath: previewRel,
          mimeType: 'image/jpeg',
          sizeBytes: stat.size,
          checksum: await checksumFile(originalAbs),
          retentionExpiresAt,
        });
      } catch (error) {
        await Promise.all([originalAbs, thumbAbs, previewAbs].map((target) => fs.unlink(target).catch(() => {})));
        throw new HttpError(
          400,
          `Não foi possível processar "${file.originalname}". Confirme que a foto é um JPG, PNG ou WebP válido.`,
          'image_processing_failed',
          { fileName: file.originalname, reason: error.message }
        );
      } finally {
        await fs.unlink(file.path).catch(() => {});
      }
    }

    return processed;
  }

  async function sendFile(res, photo, variant) {
    const pathByVariant = {
      original: photo.originalPath,
      thumb: photo.thumbPath,
      preview: photo.previewPath,
    };
    const target = pathByVariant[variant];
    if (!target) throw new HttpError(404, 'Arquivo não encontrado. Ele pode ter sido removido pela retenção ou pela edição da galeria.', 'file_not_found');
    res.set({
      'Cache-Control': variant === 'original' ? 'private, no-store' : 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    });
    res.sendFile(absolutePath(target));
  }

  async function removeOrArchive(photo, archive = false) {
    const paths = [photo.originalPath, photo.thumbPath, photo.previewPath].filter(Boolean);
    let bytes = 0;
    const errors = [];
    for (const relPath of paths) {
      try {
        const abs = absolutePath(relPath);
        const stat = await fs.stat(abs).catch(() => null);
        if (stat) bytes += stat.size;
        if (archive) {
          const archivePath = path.join(dirs.archive, relPath);
          await fs.mkdir(path.dirname(archivePath), { recursive: true });
          await fs.rename(abs, archivePath).catch(async () => fs.copyFile(abs, archivePath).then(() => fs.unlink(abs)));
        } else {
          await fs.unlink(abs).catch((error) => {
            if (error.code !== 'ENOENT') throw error;
          });
        }
      } catch (error) {
        errors.push(`${relPath}: ${error.message}`);
      }
    }
    return { bytes, errors };
  }

  return {
    ensureStorage,
    tempDir,
    storageRoot: config.storageRoot,
    maxUploadBytes: config.maxUploadMb * 1024 * 1024,
    maxFiles: config.maxFilesPerUpload,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    absolutePath,
    processUploadedFiles,
    sendFile,
    removeOrArchive,
  };
}

module.exports = { createMediaService, ALLOWED_MIME_TYPES };
