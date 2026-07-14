const express = require('express');

function createHealthRouter() {
  const router = express.Router();
  router.get('/health', (req, res) => {
    res.json({ ok: true, service: 'snapflow-api', status: 'ready' });
  });
  return router;
}

module.exports = { createHealthRouter };
