const express = require('express');
const { asyncHandler } = require('../errors');

function createAdminSettingsRouter({
  auth,
  deliveryModeSettings,
  packages,
  retention,
  watermark,
  whatsappTemplates,
}) {
  const router = express.Router();

  router.get('/settings/retention', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.getSettings());
  }));

  router.put('/settings/retention', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.updateSettings(req.body || {}));
  }));

  router.get('/settings/packages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await packages.getSettings());
  }));

  router.put('/settings/packages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await packages.updateSettings(req.body || {}));
  }));

  router.get('/settings/delivery-mode', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await deliveryModeSettings.getSettings());
  }));

  router.put('/settings/delivery-mode', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await deliveryModeSettings.updateSettings(req.body || {}));
  }));

  router.get('/settings/gallery-delivery', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await deliveryModeSettings.getSettings());
  }));

  router.put('/settings/gallery-delivery', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await deliveryModeSettings.updateSettings(req.body || {}));
  }));

  router.get('/settings/watermark', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await watermark.getSettings());
  }));

  router.put('/settings/watermark', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await watermark.updateSettings(req.body || {}));
  }));

  router.get('/settings/whatsapp-messages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await whatsappTemplates.getSettings());
  }));

  router.put('/settings/whatsapp-messages', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await whatsappTemplates.updateSettings(req.body || {}));
  }));

  return router;
}

module.exports = { createAdminSettingsRouter };
