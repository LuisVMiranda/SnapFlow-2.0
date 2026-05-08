const express = require('express');
const { HttpError, asyncHandler } = require('../errors');

function createPaymentRouter({ auth, payment, repos }) {
  const router = express.Router();

  router.get(
    '/status/:sessionId',
    asyncHandler(async (req, res) => {
      const session = await repos.getSession(req.params.sessionId);
      if (!session) throw new HttpError(404, 'Sessão não encontrada. Atualize o painel e confirme se a venda ainda existe.', 'session_not_found');
      if (session.status === 'pending' && session.paymentId) {
        await payment.approvePayment(session.paymentId);
      }
      const refreshed = await repos.getSession(req.params.sessionId);
      res.json({
        status: refreshed.status,
        deliveryStatus: refreshed.deliveryStatus,
        deliveryError: refreshed.deliveryError,
        paymentMethod: refreshed.paymentMethod,
      });
    })
  );

  router.get(
    '/session/:sessionId',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const session = await repos.getSession(req.params.sessionId);
      if (!session) throw new HttpError(404, 'Sessão não encontrada. Atualize o painel e confirme se a venda ainda existe.', 'session_not_found');
      res.json(session);
    })
  );

  router.post(
    '/webhook',
    asyncHandler(async (req, res) => {
      await payment.handleWebhook(req);
      res.status(200).send('OK');
    })
  );

  return router;
}

module.exports = { createPaymentRouter };
