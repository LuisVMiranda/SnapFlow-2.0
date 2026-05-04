const express = require('express');
const { asyncHandler } = require('../errors');

function createCredentialRouter({ auth, credentials }) {
  const router = express.Router();

  router.get('/credentials', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await credentials.listCredentials());
  }));

  router.put('/credentials/:key', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await credentials.updateCredential(req.params.key, req.body || {}));
  }));

  router.delete('/credentials/:key', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await credentials.deleteCredential(req.params.key, req.body || {}));
  }));

  return router;
}

module.exports = { createCredentialRouter };
