const express = require('express');
const { asyncHandler } = require('../errors');

function createPhotoPresetRouter({ auth, galleryPresets, photoPresets }) {
  const router = express.Router();

  router.get('/settings/photo-presets', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await photoPresets.getPresets());
  }));

  router.put('/settings/photo-presets', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await photoPresets.savePresets(req.body.presets || []));
  }));

  router.post('/settings/photo-presets', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.status(201).json(await photoPresets.createPreset(req.body || {}));
  }));

  router.patch('/settings/photo-presets/:presetId', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await photoPresets.updatePreset(req.params.presetId, req.body || {}));
  }));

  router.delete('/settings/photo-presets/:presetId', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await photoPresets.deletePreset(req.params.presetId));
  }));

  router.post('/share-sessions/:token/photo-presets', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await galleryPresets.applyGalleryPresets(req.params.token, req.body.presetIds || [], {
      confirmReplace: Boolean(req.body.confirmReplace),
    }));
  }));

  router.delete('/share-sessions/:token/photo-presets', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await galleryPresets.removeGalleryPresets(req.params.token, {
      confirmRemove: Boolean(req.body.confirmRemove),
    }));
  }));

  router.post('/share-sessions/:token/photo-presets/undo', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await galleryPresets.undoGalleryPresetApplication(req.params.token));
  }));

  return router;
}

module.exports = { createPhotoPresetRouter };
