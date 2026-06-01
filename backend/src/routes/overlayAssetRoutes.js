const fs = require('fs');
const multer = require('multer');
const path = require('path');
const express = require('express');
const { HttpError, asyncHandler } = require('../errors');

function createOverlayAssetUploader(media) {
  fs.mkdirSync(media.tempDir(), { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, media.tempDir()),
    filename: (req, file, cb) => cb(null, `overlay-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname) || '.img'}`),
  });
  const uploader = multer({
    storage,
    limits: { fileSize: media.maxOverlayAssetBytes },
    fileFilter: (req, file, cb) => {
      if (!media.allowedOverlayMimeTypes.has(file.mimetype)) {
        cb(new HttpError(
          400,
          `Tipo de overlay não permitido para "${file.originalname}". Envie PNG, JPG ou WebP.`,
          'overlay_asset_invalid_type',
          {
            fileName: file.originalname,
            receivedType: file.mimetype,
            allowedTypes: Array.from(media.allowedOverlayMimeTypes),
          }
        ));
        return;
      }
      cb(null, true);
    },
  });

  return (req, res, next) => {
    uploader.single('asset')(req, res, (error) => {
      if (error) {
        if (error.name === 'MulterError' && error.code === 'LIMIT_FILE_SIZE') {
          next(new HttpError(413, 'O overlay deve ter até 5 MB.', 'overlay_asset_too_large'));
          return;
        }
        next(error);
        return;
      }
      if (!req.file) {
        next(new HttpError(400, 'Envie uma imagem para criar o overlay.', 'overlay_asset_required'));
        return;
      }
      next();
    });
  };
}

function createOverlayAssetRouter({ auth, galleryOverlays, media, overlayAssets }) {
  const router = express.Router();
  const uploadAsset = createOverlayAssetUploader(media);

  router.get('/overlay-assets', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json({ assets: await overlayAssets.listAssets() });
  }));

  router.post('/overlay-assets', auth.requireAdmin, uploadAsset, asyncHandler(async (req, res) => {
    res.status(201).json(await overlayAssets.createAsset(req.file, req.body || {}));
  }));

  router.patch('/overlay-assets/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await overlayAssets.updateAsset(req.params.id, req.body || {}));
  }));

  router.delete('/overlay-assets/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json({ deleted: await overlayAssets.deleteAsset(req.params.id) });
  }));

  router.patch('/share-sessions/:token/overlay', auth.requireAdmin, asyncHandler(async (req, res) => {
    const result = await galleryOverlays.assignToShare(req.params.token, {
      assetId: req.body?.assetId,
      enabled: req.body?.enabled,
      settings: req.body?.settings,
    });
    res.json(result);
  }));

  router.delete('/share-sessions/:token/overlay', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await galleryOverlays.clearFromShare(req.params.token));
  }));

  return router;
}

module.exports = { createOverlayAssetRouter, createOverlayAssetUploader };
