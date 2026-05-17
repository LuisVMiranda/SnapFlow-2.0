const crypto = require('crypto');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { HttpError } = require('../errors');
const { resolvePayerEmail } = require('./email');

function createPaymentClient(accessToken) {
  return new Payment(new MercadoPagoConfig({ accessToken: accessToken || 'missing' }));
}

function parseSignatureHeader(signature = '') {
  return String(signature)
    .split(',')
    .map((part) => part.trim().split('='))
    .reduce((parsed, [key, value]) => {
      if (key && value) parsed[key] = value;
      return parsed;
    }, {});
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function webhookSignatureTemplate(req, ts) {
  const pieces = [];
  const dataId = req.query?.['data.id'];
  const requestId = req.get('x-request-id');
  if (dataId) pieces.push(`id:${dataId};`);
  if (requestId) pieces.push(`request-id:${requestId};`);
  if (ts) pieces.push(`ts:${ts};`);
  return pieces.join('');
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
      throw new HttpError(500, 'Token do Mercado Pago ausente. Configure MP_ACCESS_TOKEN em Credenciais ou no backend\\.env.local antes de gerar Pix.', 'mp_token_missing');
    }

    const response = await createPaymentClient(accessToken).create({
      body: {
        transaction_amount: Number(payload.total),
        payment_method_id: 'pix',
        description: `SnapFlow - Pacote ${payload.count} foto(s)`,
        payer: { email: resolvePayerEmail(payload.clientEmail, payload.sessionId) },
        metadata: { session_id: payload.sessionId },
      },
    });

    await repos.createSession(
      {
        id: payload.sessionId,
        amount: payload.total,
        subtotal: payload.subtotal === undefined ? payload.total : payload.subtotal,
        discountAmount: payload.discountAmount || 0,
        photoCount: payload.count,
        packageType: payload.packageType,
        phone: payload.phone,
        clientName: payload.clientName || '',
        clientEmail: payload.clientEmail || '',
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
    const link = payload.shareToken ? new URL(`/s/${payload.shareToken}`, baseUrl).toString() : '';
    const whatsappMessage = whatsappTemplates
      ? await whatsappTemplates.renderPaymentWaitingMessage({
          link,
          linkLabel: 'Abrir pedido',
          count: payload.count,
          total: payload.total,
          phone: payload.phone,
          name: payload.clientName || '',
          clientName: payload.clientName || '',
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
      if (session) {
        if (typeof repos.recordConversionEvent === 'function') {
          await repos.recordConversionEvent({
            type: 'payment_approved',
            shareToken: session.shareToken,
            sessionId: session.id,
            photoCount: session.photoCount,
            amount: session.amount,
          }).catch((error) => console.warn(`Falha ao registrar conversao de pagamento: ${error.message}`));
        }
        await deliveryQueue.enqueue(session.id);
      }
      return session;
    }
    return null;
  }

  async function verifyWebhook(req) {
    const webhookSecret = await mercadoPagoWebhookSecret();
    if (!webhookSecret) {
      throw new HttpError(500, 'Segredo do webhook do Mercado Pago ausente. Configure MP_WEBHOOK_SECRET em Credenciais ou no backend\\.env.local para confirmar pagamentos automaticamente.', 'mp_webhook_secret_missing');
    }
    const snapflowSignature = req.get('x-snapflow-signature') || '';
    if (snapflowSignature) {
      const raw = JSON.stringify(req.body || {});
      const expected = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
      const normalized = snapflowSignature.includes('=') ? snapflowSignature.split('=').pop() : snapflowSignature;
      if (!timingSafeEqualText(normalized, expected)) {
        throw new HttpError(401, 'Assinatura de webhook inválida.', 'webhook_signature_invalid');
      }
      return;
    }

    const signature = req.get('x-signature') || '';
    if (!signature) throw new HttpError(401, 'Webhook sem assinatura.', 'webhook_signature_missing');
    const parsedSignature = parseSignatureHeader(signature);
    if (!parsedSignature.ts || !parsedSignature.v1) {
      throw new HttpError(401, 'Assinatura de webhook incompleta.', 'webhook_signature_invalid');
    }
    const signedTemplate = webhookSignatureTemplate(req, parsedSignature.ts);
    const expected = crypto.createHmac('sha256', webhookSecret).update(signedTemplate).digest('hex');
    if (!timingSafeEqualText(parsedSignature.v1, expected)) {
      throw new HttpError(401, 'Assinatura de webhook inválida.', 'webhook_signature_invalid');
    }
  }

  async function handleWebhook(req) {
    await verifyWebhook(req);
    const dataId = req.query['data.id'] || req.body.data?.id || req.body.id;
    const topic = req.query.topic || req.query.type || req.body.type;
    const action = req.body.action || req.query.action;
    if ((topic === 'payment' || topic === 'payment.updated' || String(action || '').startsWith('payment.')) && dataId) {
      await approvePayment(dataId);
    }
  }

  return { createPixPayment, approvePayment, handleWebhook, verifyWebhook };
}

module.exports = { createPaymentService, parseSignatureHeader, webhookSignatureTemplate };
