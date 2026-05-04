const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { HttpError } = require('../errors');

function toPhotoIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : item?.id))
    .filter(Boolean);
}

function buildShareLinkMessage(link, code, expiresMinutes) {
  return [
    'Ola! Seu link SnapFlow foi liberado.',
    `Link: ${link}`,
    `Código: ${code}`,
    `Expira em ate ${expiresMinutes} minuto(s).`,
    'Abra pelo navegador e selecione suas fotos.',
  ].join('\n');
}

function publicBaseUrlForRequest(req, config) {
  const candidates = [req.get('origin'), req.get('referer')];
  for (const candidate of candidates) {
    try {
      if (!candidate) continue;
      const parsed = new URL(candidate);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed request headers and use configured fallback.
    }
  }
  return config.publicBaseUrl;
}

function createUploader(config, media) {
  fs.mkdirSync(media.tempDir(), { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, media.tempDir()),
    filename: (req, file, cb) => cb(null, `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname) || '.img'}`),
  });
  const uploader = multer({
    storage,
    limits: {
      fileSize: media.maxUploadBytes,
      files: config.maxFilesPerUpload,
    },
    fileFilter: (req, file, cb) => {
      if (!media.allowedMimeTypes.has(file.mimetype)) {
        cb(new HttpError(
          400,
          `Tipo de arquivo não permitido para "${file.originalname}". Envie JPG, PNG ou WebP.`,
          'invalid_file_type',
          {
            fileName: file.originalname,
            receivedType: file.mimetype,
            allowedTypes: Array.from(media.allowedMimeTypes),
          }
        ));
        return;
      }
      cb(null, true);
    },
  });

  uploader.photos = (req, res, next) => {
    uploader.array('photos', config.maxFilesPerUpload)(req, res, (error) => {
      if (error) {
        if (error.name === 'MulterError' && error.code === 'LIMIT_FILE_SIZE') {
          next(new HttpError(
            413,
            `Uma ou mais fotos excedem o limite de ${config.maxUploadMb} MB por arquivo.`,
            'upload_file_too_large',
            { maxUploadMb: config.maxUploadMb, maxUploadBytes: media.maxUploadBytes }
          ));
          return;
        }
        if (error.name === 'MulterError' && error.code === 'LIMIT_FILE_COUNT') {
          next(new HttpError(
            400,
            `Envio limitado a ${config.maxFilesPerUpload} foto(s) por vez.`,
            'upload_file_count_exceeded',
            { maxFilesPerUpload: config.maxFilesPerUpload }
          ));
          return;
        }
        next(error);
        return;
      }
      if (!req.files || req.files.length === 0) {
        next(new HttpError(400, 'Nenhuma foto foi recebida pelo servidor.', 'upload_empty'));
        return;
      }
      next();
    });
  };

  return uploader;
}

module.exports = { buildShareLinkMessage, createUploader, publicBaseUrlForRequest, toPhotoIds };
