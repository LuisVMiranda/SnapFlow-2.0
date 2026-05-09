import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { PackageSettingsModal } from './PackageSettingsModal';
import { RetentionPanel } from './RetentionPanel';
import { WatermarkSettingsPanel } from './WatermarkSettingsPanel';
import { WhatsAppTemplatesPanel } from './WhatsAppTemplatesPanel';

export function SettingsPanel({
  cleanupPreview,
  packageSettingsStatus,
  previewCleanup,
  pricingOptions,
  runCleanup,
  savePackageSettings,
  saveRetentionSettings,
  saveWatermarkSettings,
  saveWhatsAppTemplates,
  setRetentionSettings,
  setType,
  retentionSettings,
  type,
  whatsAppTemplateStatus,
  whatsAppTemplates,
  watermarkSettings,
  watermarkSettingsStatus,
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
        emoji="🖼️"
        help="Ajuste como o texto SnapFlow aparece nas imagens de prévia enviadas ao cliente."
        title="Marca d'água das prévias"
      >
        <WatermarkSettingsPanel
          embedded
          onSave={saveWatermarkSettings}
          settings={watermarkSettings}
          status={watermarkSettingsStatus}
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
