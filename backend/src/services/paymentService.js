const crypto = require('crypto');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { HttpError } = require('../errors');

function createPaymentClient(accessToken) {
  return new Payment(new MercadoPagoConfig({ accessToken: accessToken || 'missing' }));
}

function createPaymentService({ config, repos, deliveryQueue, credentials, whatsappTemplates }) {
  async function mercadoPagoAccessToken() {
    return (typeof credentials?.getSecretValue === 'function' ? await credentials.getSecretValue('mpAccessToken') : '') || config.mercadoPagoAccessToken;
  }

  async function mercadoPagoWebhookSecret() {
    return (typeof credentials?.getSecretValue === 'function' ? await credentials.getSecretValue('mpWebhookSecret') : '') || config.mercadoPagoWebhookSecret;
  }

  async function publicBaseUrl() {
    return (typeof credentials?.getSecretValue === 'function' ? await credentials.getSecretValue('publicBaseUrl') : '') || config.publicBaseUrl;
  }

  async function createPixPayment(payload) {
    const accessToken = await mercadoPagoAccessToken();
    if (!accessToken || accessToken.includes('your-mercado-pago-token')) {
      throw new HttpError(500, 'Token Mercado Pago ausente.', 'mp_token_missing');
    }

    const response = await createPaymentClient(accessToken).create({
      body: {
        transaction_amount: Number(payload.total),
        payment_method_id: 'pix',
        description: `SnapFlow - Pacote ${payload.count} foto(s)`,
        payer: { email: 'contato@snapflow.local' },
        metadata: { session_id: payload.sessionId },
      },
    });

    await repos.createSession(
      {
        id: payload.sessionId,
        amount: payload.total,
        photoCount: payload.count,
        packageType: payload.packageType,
        phone: payload.phone,
        status: 'pending',
        paymentMethod: 'PIX',
        paymentId: response.id,
        shareToken: payload.shareToken || null,
        deliveryStatus: 'idle',
      },
      payload.photoIds
    );

    const pixData = response.point_of_interaction?.transaction_data || {};
    const baseUrl = await publicBaseUrl();
    const link = payload.shareToken ? new URL(`/s/${payload.shareToken}`, baseUrl).toString() : baseUrl;
    const whatsappMessage = whatsappTemplates
      ? await whatsappTemplates.renderPaymentWaitingMessage({
          link,
          linkLabel: 'Abrir pedido',
          count: payload.count,
          total: payload.total,
          phone: payload.phone,
          sessionId: payload.sessionId,
        })
      : '';

    return {
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
      payment_id: response.id,
      whatsappMessage,
    };
  }

  async function approvePayment(paymentId) {
    const payInfo = await createPaymentClient(await mercadoPagoAccessToken()).get({ id: paymentId });
    const sessionId = payInfo.metadata?.session_id;
    await repos.recordPaymentEvent({
      providerEventId: `payment:${paymentId}:${payInfo.status}`,
      paymentId,
      sessionId,
      status: payInfo.status,
      rawPayload: payInfo,
    });

    if (sessionId && payInfo.status === 'approved') {
      const session = await repos.approveSession(sessionId);
      if (session) await deliveryQueue.enqueue(session.id);
      return session;
    }
    return null;
  }

  async function verifyWebhook(req) {
    const webhookSecret = await mercadoPagoWebhookSecret();
    if (!webhookSecret) {
      throw new HttpError(500, 'MP_WEBHOOK_SECRET ausente no servidor.', 'mp_webhook_secret_missing');
    }
    const signature = req.get('x-signature') || req.get('x-snapflow-signature') || '';
    if (!signature) throw new HttpError(401, 'Webhook sem assinatura.', 'webhook_signature_missing');

    const raw = JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
    const normalized = signature.includes('=') ? signature.split('=').pop() : signature;
    if (normalized.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expected))) {
      throw new HttpError(401, 'Assinatura de webhook inválida.', 'webhook_signature_invalid');
    }
  }

  async function handleWebhook(req) {
    await verifyWebhook(req);
    const dataId = req.query['data.id'] || req.body.data?.id || req.body.id;
    const topic = req.query.topic || req.query.type || req.body.type;
    if ((topic === 'payment' || topic === 'payment.updated') && dataId) {
      await approvePayment(dataId);
    }
  }

  return { createPixPayment, approvePayment, handleWebhook, verifyWebhook };
}

module.exports = { createPaymentService };
