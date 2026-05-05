const cors = require('cors');
const express = require('express');
const { createAuth } = require('./auth');
const { errorHandler } = require('./errors');
const { createAdminRouter } = require('./routes/adminRoutes');
const { createCredentialRouter } = require('./routes/credentialRoutes');
const { buildShareLinkMessage, createUploader } = require('./routes/helpers');
const { createHealthRouter } = require('./routes/healthRoutes');
const { createMediaRouter } = require('./routes/mediaRoutes');
const { createPackageRouter } = require('./routes/packageRoutes');
const { createPaymentRouter } = require('./routes/paymentRoutes');
const { createShareRouter } = require('./routes/shareRoutes');

function createApp({ config, repos, media, payment, deliveryQueue, retention, packages, credentials, whatsapp, whatsappTemplates }) {
  const app = express();
  const auth = createAuth(config);
  const upload = createUploader(config, media);
  const deps = { auth, config, credentials, deliveryQueue, media, packages, payment, repos, retention, upload, whatsapp, whatsappTemplates };

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createHealthRouter());
  app.use('/api', createPackageRouter(deps));
  app.use('/api/admin', createAdminRouter(deps));
  app.use('/api/admin', createCredentialRouter(deps));
  app.use('/api', createShareRouter(deps));
  app.use('/api', createMediaRouter(deps));
  app.use('/api', createPaymentRouter(deps));
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: `Rota da API não encontrada: ${req.method} ${req.originalUrl}`,
      code: 'api_route_not_found',
    });
  });
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, buildShareLinkMessage };
