const express = require('express');
const { asyncHandler } = require('../errors');

function createPackageRouter({ packages }) {
  const router = express.Router();

  router.get('/packages', asyncHandler(async (req, res) => {
    res.json(await packages.getSettings());
  }));

  return router;
}

module.exports = { createPackageRouter };
