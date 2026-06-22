const cors = require('cors');
const express = require('express');
const { createAuth } = require('./auth');
const { errorHandler } = require('./errors');
const { createAdminOpsRouter } = require('./routes/adminOpsRoutes');
const { createAdminRouter } = require('./routes/adminRoutes');
const { createAdminSettingsRouter } = require('./routes/adminSettingsRoutes');
const { createCredentialRouter } = require('./routes/credentialRoutes');
const { buildShareLinkMessage, createUploader } = require('./routes/helpers');
const { createHealthRouter } = require('./routes/healthRoutes');
const { createMediaRouter } = require('./routes/mediaRoutes');
const { createPackageRouter } = require('./routes/packageRoutes');
const { createPaymentRouter } = require('./routes/paymentRoutes');
const { createPhotoPresetRouter } = require('./routes/photoPresetRoutes');
const { createShareRouter } = require('./routes/shareRoutes');
const { createStoryDeliveryRouter } = require('./routes/storyDeliveryRoutes');
const { createOverlayAssetRouter } = require('./routes/overlayAssetRoutes');
const { createWatermarkAssetRouter } = require('./routes/watermarkAssetRoutes');
const { createGalleryOverlayService } = require('./services/galleryOverlayService');
const { createGalleryWatermarkService } = require('./services/galleryWatermarkService');
const { createGalleryPresetService } = require('./services/galleryPresetService');
const { createPhotoEditingPresetService } = require('./services/photoEditingPresetService');
const { createOverlayAssetService } = require('./services/overlayAssetService');
const { createDeliveryModeSettingsService } = require('./services/deliveryModeService');
const { createDeliveryReleaseService } = require('./services/deliveryReleaseService');
const { createStoryDeliverySettingsService } = require('./services/storyDeliverySettingsService');
const { createWatermarkAssetService } = require('./services/watermarkAssetService');

function createApp({ config, repos, media, payment, deliveryQueue, deliveryModeSettings: providedDeliveryModeSettings, deliveryRelease: providedDeliveryRelease, retention, packages, credentials, whatsapp, whatsappTemplates, watermark, photoPresets: providedPhotoPresets, galleryPresets: providedGalleryPresets, galleryOverlays: providedGalleryOverlays, galleryWatermarks: providedGalleryWatermarks, overlayAssets: providedOverlayAssets, storyDelivery: providedStoryDelivery, watermarkAssets: providedWatermarkAssets }) {
  const app = express();
  const auth = createAuth(config);
  const upload = createUploader(config, media);
  const photoPresets = providedPhotoPresets || createPhotoEditingPresetService({ repos });
  const overlayAssets = providedOverlayAssets || createOverlayAssetService({ media, repos });
  const storyDelivery = providedStoryDelivery || createStoryDeliverySettingsService({ repos });
  const deliveryModeSettings = providedDeliveryModeSettings || createDeliveryModeSettingsService({ repos });
  const deliveryRelease = providedDeliveryRelease || createDeliveryReleaseService({ deliveryQueue, repos });
  const watermarkAssets = providedWatermarkAssets || createWatermarkAssetService({ media, repos });
  const galleryOverlays = providedGalleryOverlays || createGalleryOverlayService({ media, repos, watermarkSettings: watermark });
  const galleryWatermarks = providedGalleryWatermarks || createGalleryWatermarkService({ media, repos, watermarkSettings: watermark });
  const galleryPresets = providedGalleryPresets || createGalleryPresetService({ galleryOverlays, galleryWatermarks, media, photoPresets, repos });
  const deps = { auth, config, credentials, deliveryModeSettings, deliveryQueue, deliveryRelease, galleryOverlays, galleryPresets, galleryWatermarks, media, overlayAssets, packages, payment, photoPresets, repos, retention, storyDelivery, upload, watermarkAssets, whatsapp, whatsappTemplates, watermark };

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createHealthRouter());
  app.use('/api', createPackageRouter(deps));
  app.use('/api/admin', createAdminRouter(deps));
  app.use('/api/admin', createAdminSettingsRouter(deps));
  app.use('/api/admin', createAdminOpsRouter(deps));
  app.use('/api/admin', createStoryDeliveryRouter(deps));
  app.use('/api/admin', createPhotoPresetRouter(deps));
  app.use('/api/admin', createOverlayAssetRouter(deps));
  app.use('/api/admin', createWatermarkAssetRouter(deps));
  app.use('/api/admin', createCredentialRouter(deps));
  app.use('/api', createShareRouter(deps));
  app.use('/api', createMediaRouter(deps));
  app.use('/api', createPaymentRouter(deps));
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: `Rota da API não encontrada: ${req.method} ${req.originalUrl}. Reinicie o backend depois de atualizar o projeto e confirme se esta rota existe na versão atual.`,
      code: 'api_route_not_found',
    });
  });
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, buildShareLinkMessage };
