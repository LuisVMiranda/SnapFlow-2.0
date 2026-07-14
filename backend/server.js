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
const { createGalleryWatermarkService } = require('./src/services/galleryWatermarkService');
const { createGalleryOverlayService } = require('./src/services/galleryOverlayService');
const { createWatermarkAssetService } = require('./src/services/watermarkAssetService');
const { createPhotoEditingPresetService } = require('./src/services/photoEditingPresetService');
const { createGalleryPresetService } = require('./src/services/galleryPresetService');
const { createStoryDeliverySettingsService } = require('./src/services/storyDeliverySettingsService');
const { createDeliveryModeSettingsService } = require('./src/services/deliveryModeService');
const { createDeliveryReleaseService } = require('./src/services/deliveryReleaseService');
const { createGalleryAccessService } = require('./src/services/galleryAccessService');

async function main() {
  const config = createConfig();
  await runMigrations(config);
  const repos = createRepos(config);
  const watermark = createWatermarkSettingsService({ repos });
  const media = createMediaService(config, { watermarkSettings: watermark });
  const watermarkAssets = createWatermarkAssetService({ media, repos });
  const galleryWatermarks = createGalleryWatermarkService({ media, repos, watermarkSettings: watermark });
  const galleryOverlays = createGalleryOverlayService({ media, repos, watermarkSettings: watermark });
  const credentials = createCredentialsService({ config, repos });
  const whatsappTemplates = createWhatsAppTemplatesService({ repos });
  const storyDelivery = createStoryDeliverySettingsService({ repos });
  const deliveryModeSettings = createDeliveryModeSettingsService({ repos });
  const photoPresets = createPhotoEditingPresetService({ repos });
  const galleryPresets = createGalleryPresetService({ repos, media, photoPresets, galleryWatermarks, galleryOverlays });
  const whatsapp = createWhatsAppClient();
  const deliveryQueue = createDeliveryQueue({ repos, media, whatsapp, whatsappTemplates, galleryOverlays });
  const galleryAccess = createGalleryAccessService({ repos });
  const deliveryRelease = createDeliveryReleaseService({ deliveryQueue, galleryAccess, repos });
  const payment = createPaymentService({ config, repos, deliveryQueue, deliveryRelease, credentials, whatsappTemplates });
  const packages = createPackageSettingsService({ repos });
  const retention = createRetentionService({ repos, media });
  const app = createApp({ config, repos, media, payment, deliveryQueue, deliveryModeSettings, deliveryRelease, retention, packages, credentials, whatsapp, whatsappTemplates, watermark, photoPresets, galleryPresets, galleryOverlays, galleryWatermarks, storyDelivery, watermarkAssets });

  const server = app.listen(config.port, config.host, () => {
    console.log(`API rodando em ${config.host}:${config.port}`);
    console.log('SnapFlow pronto com Postgres, armazenamento privado e fila de entrega.');
    console.log(config.autoEnhanceEnabled
      ? `Auto Enhance ativado no upload (${config.autoEnhanceLevel}). Para usar apenas presets manuais, defina AUTO_ENHANCE=false.`
      : 'Auto Enhance desligado no upload. Presets manuais continuam disponiveis por galeria.');
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
