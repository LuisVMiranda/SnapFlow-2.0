import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { DeliveryModeSettingsPanel } from './DeliveryModeSettingsPanel';
import { PackageSettingsModal } from './PackageSettingsModal';
import { OverlayAssetLibraryPanel } from './OverlayAssetLibraryPanel';
import { PhotoPresetSettingsPanel } from './PhotoPresetSettingsPanel';
import { RetentionPanel } from './RetentionPanel';
import { StoryDeliverySettingsPanel } from './StoryDeliverySettingsPanel';
import { WatermarkAssetLibraryPanel } from './WatermarkAssetLibraryPanel';
import { WatermarkSettingsPanel } from './WatermarkSettingsPanel';
import { WhatsAppTemplatesPanel } from './WhatsAppTemplatesPanel';

export function SettingsPanel({
  cleanupPreview,
  createPhotoPreset,
  deletePhotoPreset,
  deleteOverlayAsset,
  deleteWatermarkAsset,
  deliveryModeSettings,
  deliveryModeStatus,
  overlayAssets,
  overlayAssetStatus,
  packageSettingsStatus,
  photoPresets,
  photoPresetStatus,
  previewCleanup,
  pricingOptions,
  runCleanup,
  savePackageSettings,
  saveDeliveryModeSettings,
  saveRetentionSettings,
  saveStoryDeliverySettings,
  saveWatermarkSettings,
  saveWhatsAppTemplates,
  setRetentionSettings,
  setType,
  storyDeliverySettings,
  storyDeliveryStatus,
  retentionSettings,
  type,
  updatePhotoPreset,
  updateOverlayAsset,
  updateWatermarkAsset,
  uploadOverlayAsset,
  whatsAppTemplateStatus,
  whatsAppTemplates,
  watermarkAssets,
  watermarkAssetStatus,
  watermarkSettings,
  watermarkSettingsStatus,
  uploadWatermarkAsset,
}) {
  const [isPackageEditorOpen, setIsPackageEditorOpen] = useState(false);

  const handleSavePackages = async (draft) => {
    const saved = await savePackageSettings(draft);
    if (saved && !draft[type]) {
      setType(Object.keys(draft)[0]);
    }
    return saved;
  };

  return (
    <section className="admin-panel">
      <CollapsibleSection
        emoji="🧹"
        help="Defina prazos e limpezas para fotos, galerias expiradas e arquivos locais."
        title="Retenção e sanitização"
      >
        <RetentionPanel
          cleanupPreview={cleanupPreview}
          embedded
          previewCleanup={previewCleanup}
          retentionSettings={retentionSettings}
          runCleanup={runCleanup}
          saveRetentionSettings={saveRetentionSettings}
          setRetentionSettings={setRetentionSettings}
        />
      </CollapsibleSection>

      <CollapsibleSection
        emoji="💳"
        help="Crie, edite ou remova opções de venda sem alterar o fluxo do cliente."
        title="Pacotes e preços"
      >
        <div className="package-management-card">
          <div className="package-management-list">
            {Object.entries(pricingOptions).map(([key, option]) => (
              <div className="package-management-item" key={key}>
                <strong>{option.label}</strong>
                <small>
                  {option.threshold}+ fotos: R$ {option.bulk} · avulsa: R$ {option.unit}
                </small>
              </div>
            ))}
          </div>

          <button type="button" className="btn-manual btn-manual-card" onClick={() => setIsPackageEditorOpen(true)}>
            <Pencil size={16} />
            Editar pacotes
          </button>
        </div>
      </CollapsibleSection>

      <PackageSettingsModal
        isOpen={isPackageEditorOpen}
        onClose={() => setIsPackageEditorOpen(false)}
        onSave={handleSavePackages}
        pricingOptions={pricingOptions}
        status={packageSettingsStatus}
      />

      <CollapsibleSection
        emoji="📦"
        help="Defina se novas galerias entregam por WhatsApp, por download na galeria ou pelos dois canais."
        title="Entrega da galeria"
      >
        <DeliveryModeSettingsPanel
          onSave={saveDeliveryModeSettings}
          settings={deliveryModeSettings}
          status={deliveryModeStatus}
        />
      </CollapsibleSection>

      <CollapsibleSection
        emoji="🖼️"
        help="Ajuste como o texto SnapFlow aparece nas imagens de prévia enviadas ao cliente."
        title="Marca d'água das prévias"
      >
        <WatermarkAssetLibraryPanel
          assets={watermarkAssets}
          deleteAsset={deleteWatermarkAsset}
          status={watermarkAssetStatus}
          updateAsset={updateWatermarkAsset}
          uploadAsset={uploadWatermarkAsset}
        />
        <WatermarkSettingsPanel
          embedded
          onSave={saveWatermarkSettings}
          settings={watermarkSettings}
          status={watermarkSettingsStatus}
        />
      </CollapsibleSection>

      <CollapsibleSection
        emoji="🧩"
        help="Envie imagens reutilizaveis para aplicar como camada visual nas previas de uma galeria."
        title="Overlays de galeria"
      >
        <OverlayAssetLibraryPanel
          assets={overlayAssets}
          deleteAsset={deleteOverlayAsset}
          status={overlayAssetStatus}
          updateAsset={updateOverlayAsset}
          uploadAsset={uploadOverlayAsset}
        />
        <StoryDeliverySettingsPanel
          onSave={saveStoryDeliverySettings}
          settings={storyDeliverySettings}
          status={storyDeliveryStatus}
        />
      </CollapsibleSection>

      <CollapsibleSection
        emoji="🎚️"
        help="Crie ajustes reutilizáveis para aplicar nas fotos originais e miniaturas das galerias."
        title="Presets de edição das fotos"
      >
        <PhotoPresetSettingsPanel
          createPhotoPreset={createPhotoPreset}
          deletePhotoPreset={deletePhotoPreset}
          embedded
          photoPresets={photoPresets}
          status={photoPresetStatus}
          updatePhotoPreset={updatePhotoPreset}
        />
      </CollapsibleSection>

      <CollapsibleSection
        emoji="💬"
        help="Personalize os textos enviados ou copiados para o cliente em cada etapa da venda."
        title="Mensagens do WhatsApp"
      >
        <WhatsAppTemplatesPanel
          embedded
          saveWhatsAppTemplates={saveWhatsAppTemplates}
          status={whatsAppTemplateStatus}
          templates={whatsAppTemplates}
        />
      </CollapsibleSection>
    </section>
  );
}
