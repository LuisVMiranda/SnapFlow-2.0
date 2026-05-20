const express = require('express');
const { HttpError, asyncHandler } = require('../errors');

function readableError(error, fallback) {
  if (!error) return fallback;
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  const text = String(error || '').trim();
  return text || fallback;
}

function safeWhatsAppStatus(whatsapp) {
  const unavailable = {
    ready: false,
    status: 'unavailable',
    lastError: 'Cliente WhatsApp indisponível. Reinicie o backend e abra Vendas para parear novamente.',
  };
  if (!whatsapp || typeof whatsapp.getStatus !== 'function') return unavailable;
  try {
    return whatsapp.getStatus();
  } catch (error) {
    const message = readableError(
      error,
      'Não foi possível consultar o status do WhatsApp. Use Reconectar WhatsApp ou reinicie o backend se persistir.'
    );
    return {
      ready: false,
      status: 'status_failed',
      lastError: message,
    };
  }
}

function createAdminOpsRouter({ auth, deliveryQueue, repos, retention, whatsapp }) {
  const router = express.Router();

  router.get('/whatsapp/status', auth.requireAdmin, (req, res) => {
    res.json(safeWhatsAppStatus(whatsapp));
  });

  router.post('/whatsapp/reconnect', auth.requireAdmin, asyncHandler(async (req, res) => {
    if (!whatsapp || typeof whatsapp.reconnect !== 'function') throw new HttpError(503, 'Cliente WhatsApp indisponível. Reinicie o backend e abra Vendas para parear novamente.', 'whatsapp_unavailable');
    whatsapp.reconnect().catch((error) => {
      console.warn(`Reconexão manual do WhatsApp falhou: ${readableError(error, 'falha desconhecida')}`);
    });
    res.status(202).json(safeWhatsAppStatus(whatsapp));
  }));

  router.post('/whatsapp/reset-auth', auth.requireAdmin, asyncHandler(async (req, res) => {
    if (!whatsapp || typeof whatsapp.resetAuth !== 'function') throw new HttpError(503, 'Cliente WhatsApp indisponível. Reinicie o backend e abra Vendas para parear novamente.', 'whatsapp_unavailable');
    res.status(202).json(await whatsapp.resetAuth());
  }));

  router.post('/cleanup/preview', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.preview());
  }));

  router.post('/cleanup/run', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await retention.run());
  }));

  router.post('/delivery-jobs/:id/retry', auth.requireAdmin, asyncHandler(async (req, res) => {
    const job = await repos.retryDeliveryJob(req.params.id);
    if (!job) throw new HttpError(404, 'Entrega não encontrada. Atualize Vendas e confirme se esta venda ainda aparece no painel.', 'delivery_job_not_found');
    res.json(job);
  }));

  router.post('/sessions/:sessionId/cancel-release', auth.requireAdmin, asyncHandler(async (req, res) => {
    const session = await repos.getSession(req.params.sessionId);
    if (!session) throw new HttpError(404, 'Sessão não encontrada. Atualize o painel e confirme se a venda ainda existe.', 'session_not_found');
    if (session.status === 'approved') {
      throw new HttpError(409, 'Esta venda já foi aprovada e não pode ter a liberação cancelada por aqui.', 'session_already_approved');
    }
    if (session.status === 'cancelled') {
      res.json({ success: true, session });
      return;
    }
    if (session.status !== 'pending' || session.paymentMethod !== 'Dinheiro/Cartão') {
      throw new HttpError(409, 'Somente vendas pendentes em dinheiro/cartao podem ter a liberação cancelada.', 'session_cancel_not_allowed');
    }
    const cancelled = await repos.cancelManualSessionRelease(session.id);
    if (!cancelled) throw new HttpError(409, 'Não foi possível cancelar esta liberação. Atualize o painel e confira o status atual.', 'session_cancel_failed');
    res.json({ success: true, session: cancelled });
  }));

  router.post('/sessions/:sessionId/retry-delivery', auth.requireAdmin, asyncHandler(async (req, res) => {
    const session = await repos.getSession(req.params.sessionId);
    if (!session) throw new HttpError(404, 'Sessão não encontrada. Atualize o painel e confirme se a venda ainda existe.', 'session_not_found');
    if (session.status !== 'approved') {
      throw new HttpError(409, 'A sessão ainda não foi aprovada para envio. Libere o pagamento no painel antes de reenviar as fotos.', 'session_not_approved');
    }
    const job = await repos.retryDeliveryForSession(session.id);
    await repos.updateDeliveryStatus(session.id, 'queued', null);
    if (typeof deliveryQueue.processOnce === 'function') await deliveryQueue.processOnce();
    res.json({ success: true, job, session: await repos.getSession(session.id) });
  }));

  router.post('/stats/clear', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json(await repos.clearSalesStats());
  }));

  router.get('/session/:sessionId', auth.requireAdmin, asyncHandler(async (req, res) => {
    const session = await repos.getSession(req.params.sessionId);
    if (!session) throw new HttpError(404, 'Sessão não encontrada. Atualize o painel e confirme se a venda ainda existe.', 'session_not_found');
    res.json(session);
  }));

  return router;
}

module.exports = { createAdminOpsRouter };
