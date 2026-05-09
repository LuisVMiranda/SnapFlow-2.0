const { loadEnv } = require('./src/loadEnv');

loadEnv();

const { createApp } = require('./src/app');
const { createConfig } = require('./src/config');
const { createRepos } = require('./src/repos');
const { runMigrations } = require('./src/migrations/runMigrations');
const { createPaymentService } = require('./src/services/paymentService');
const { createMediaService } = require('./src/services/mediaService');
const { createDeliveryQueue } = require('./src/services/deliveryQueue');
const { createWhatsAppClient } = require('./src/services/whatsappClient');
const { createCredentialsService } = require('./src/services/credentialsService');
const { createPackageSettingsService } = require('./src/services/packageSettingsService');
const { createRetentionService } = require('./src/services/retentionService');
const { createWhatsAppTemplatesService } = require('./src/services/whatsappTemplatesService');
const { createWatermarkSettingsService } = require('./src/services/watermarkSettingsService');

async function main() {
  const config = createConfig();
  await runMigrations(config);
  const repos = createRepos(config);
  const watermark = createWatermarkSettingsService({ repos });
  const media = createMediaService(config, { watermarkSettings: watermark });
  const credentials = createCredentialsService({ config, repos });
  const whatsappTemplates = createWhatsAppTemplatesService({ repos });
  const whatsapp = createWhatsAppClient();
  const deliveryQueue = createDeliveryQueue({ repos, media, whatsapp, whatsappTemplates });
  const payment = createPaymentService({ config, repos, deliveryQueue, credentials, whatsappTemplates });
  const packages = createPackageSettingsService({ repos });
  const retention = createRetentionService({ repos, media });
  const app = createApp({ config, repos, media, payment, deliveryQueue, retention, packages, credentials, whatsapp, whatsappTemplates, watermark });

  const server = app.listen(config.port, config.host, () => {
    console.log(`API rodando em ${config.host}:${config.port}`);
    console.log('SnapFlow pronto com Postgres, armazenamento privado e fila de entrega.');
  });

  whatsapp.initialize().catch((error) => {
    console.warn(`Erro ao inicializar WhatsApp: ${error.message}`);
    console.log('API continua funcionando; o cliente WhatsApp tentara reconectar automaticamente.');
  });

  deliveryQueue.start();

  const shutdown = async () => {
    deliveryQueue.stop();
    server.close();
    await whatsapp.shutdown?.();
    await repos.close();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Falha ao iniciar SnapFlow:', error);
  process.exitCode = 1;
});
