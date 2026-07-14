const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const test = require('node:test');
const { createHealthRouter } = require('../src/routes/healthRoutes');

test('health endpoint identifies a fully started SnapFlow API', async () => {
  const app = express();
  app.use('/api', createHealthRouter());

  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, service: 'snapflow-api', status: 'ready' });
});
