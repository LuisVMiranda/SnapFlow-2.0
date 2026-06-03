const express = require('express');
const { asyncHandler } = require('../errors');

function createStoryDeliveryRouter({ auth, storyDelivery }) {
  const router = express.Router();

  router.get('/settings/story-delivery', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await storyDelivery.getSettings());
  }));

  router.put('/settings/story-delivery', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await storyDelivery.updateSettings(req.body || {}));
  }));

  return router;
}

module.exports = { createStoryDeliveryRouter };
