const fs = require('fs');
const multer = require('multer');
const path = require('path');
const express = require('express');
const { HttpError, asyncHandler } = require('../errors');

function createWatermarkAssetUploader(media) {
  fs.mkdirSync(media.tempDir(), { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, media.tempDir()),
    filename: (req, file, cb) => cb(null, `watermark-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname) || '.img'}`),
  });
  const uploader = multer({
    storage,
    limits: { fileSize: media.maxWatermarkAssetBytes },
    fileFilter: (req, file, cb) => {
      if (!media.allowedWatermarkMimeTypes.has(file.mimetype)) {
        cb(new HttpError(
          400,
          `Tipo de marca d'água não permitido para "${file.originalname}". Envie PNG, JPG ou WebP.`,
          'watermark_asset_invalid_type',
          {
            fileName: file.originalname,
            receivedType: file.mimetype,
            allowedTypes: Array.from(media.allowedWatermarkMimeTypes),
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
          next(new HttpError(413, "A marca d'água deve ter até 5 MB.", 'watermark_asset_too_large'));
          return;
        }
        next(error);
        return;
      }
      if (!req.file) {
        next(new HttpError(400, "Envie uma imagem para criar a marca d'água.", 'watermark_asset_required'));
        return;
      }
      next();
    });
  };
}

function createWatermarkAssetRouter({ auth, galleryWatermarks, media, watermarkAssets }) {
  const router = express.Router();
  const uploadAsset = createWatermarkAssetUploader(media);

  router.get('/watermark-assets', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json({ assets: await watermarkAssets.listAssets() });
  }));

  router.post('/watermark-assets', auth.requireAdmin, uploadAsset, asyncHandler(async (req, res) => {
    res.status(201).json(await watermarkAssets.createAsset(req.file, req.body || {}));
  }));

  router.patch('/watermark-assets/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await watermarkAssets.updateAsset(req.params.id, req.body || {}));
  }));

  router.delete('/watermark-assets/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json({ deleted: await watermarkAssets.deleteAsset(req.params.id) });
  }));

  router.patch('/share-sessions/:token/watermark', auth.requireAdmin, asyncHandler(async (req, res) => {
    const result = await galleryWatermarks.assignToShare(req.params.token, {
      assetId: req.body?.assetId,
      settings: req.body?.settings || {},
    });
    res.json(result);
  }));

  router.delete('/share-sessions/:token/watermark', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await galleryWatermarks.clearFromShare(req.params.token));
  }));

  return router;
}

module.exports = { createWatermarkAssetRouter, createWatermarkAssetUploader };
