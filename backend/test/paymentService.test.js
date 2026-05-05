const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { createPaymentService, webhookSignatureTemplate } = require('../src/services/paymentService');

function signedRequest({ body, query, requestId = 'request-1', secret = 'webhook-secret' }) {
  const headers = {};
  const req = {
    body,
    query,
    get(name) {
      return headers[String(name || '').toLowerCase()];
    },
  };
  const ts = '1710000000000';
  headers['x-request-id'] = requestId;
  const template = webhookSignatureTemplate(req, ts);
  const v1 = crypto.createHmac('sha256', secret).update(template).digest('hex');
  headers['x-signature'] = `ts=${ts},v1=${v1}`;
  return req;
}

test('payment service validates Mercado Pago webhook signature template', async () => {
  const service = createPaymentService({
    config: {},
    credentials: { getSecretValue: async () => 'webhook-secret' },
    deliveryQueue: { enqueue: async () => {} },
    repos: {},
  });
  const req = signedRequest({
    query: { 'data.id': 'payment_1', type: 'payment' },
    body: { action: 'payment.updated', data: { id: 'payment_1' }, type: 'payment' },
  });

  await assert.doesNotReject(() => service.verifyWebhook(req));
});

test('payment service rejects invalid Mercado Pago webhook signatures', async () => {
  const service = createPaymentService({
    config: {},
    credentials: { getSecretValue: async () => 'webhook-secret' },
    deliveryQueue: { enqueue: async () => {} },
    repos: {},
  });
  const req = signedRequest({
    query: { 'data.id': 'payment_123', type: 'payment' },
    body: { action: 'payment.updated', data: { id: 'payment_123' }, type: 'payment' },
  });
  req.get = (name) => {
    const header = String(name).toLowerCase();
    if (header === 'x-signature') return 'ts=1710000000000,v1=invalid';
    if (header === 'x-request-id') return 'request-1';
    return undefined;
  };

  await assert.rejects(() => service.verifyWebhook(req), /Assinatura de webhook inválida/);
});
