const { loadEnv } = require('./src/loadEnv');

loadEnv();

const { createApp } = require('./src/app');
const { createConfig } = require('./src/config');
const { createRepos } = require('./src/repos');
const { createPaymentService } = require('./src/services/paymentService');
const { createMediaService } = require('./src/services/mediaService');
const { createDeliveryQueue } = require('./src/services/deliveryQueue');
const { createWhatsAppClient } = require('./src/services/whatsappClient');
const { createCredentialsService } = require('./src/services/credentialsService');
const { createPackageSettingsService } = require('./src/services/packageSettingsService');
const { createRetentionService } = require('./src/services/retentionService');
const { createWhatsAppTemplatesService } = require('./src/services/whatsappTemplatesService');

async function main() {
  const config = createConfig();
  const repos = createRepos(config);
  const media = createMediaService(config);
  const credentials = createCredentialsService({ config, repos });
  const whatsappTemplates = createWhatsAppTemplatesService({ repos });
  const whatsapp = createWhatsAppClient();
  const deliveryQueue = createDeliveryQueue({ repos, media, whatsapp, whatsappTemplates });
  const payment = createPaymentService({ config, repos, deliveryQueue, credentials, whatsappTemplates });
  const packages = createPackageSettingsService({ repos });
  const retention = createRetentionService({ repos, media });
  const app = createApp({ config, repos, media, payment, deliveryQueue, retention, packages, credentials, whatsappTemplates });

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`API rodando na porta ${config.port}`);
    console.log('SnapFlow pronto com Postgres, armazenamento privado e fila de entrega.');
  });

  whatsapp.initialize().catch((error) => {
    console.warn(`Erro ao inicializar WhatsApp: ${error.message}`);
    console.log('API continua funcionando, mas a fila de entrega aguardara o WhatsApp ficar pronto.');
  });

  deliveryQueue.start();

  const shutdown = async () => {
    deliveryQueue.stop();
    server.close();
    await repos.close();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Falha ao iniciar SnapFlow:', error);
  process.exitCode = 1;
});
