import { useState } from 'react';
import { Pencil } from 'lucide-react';
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
      <RetentionPanel
        cleanupPreview={cleanupPreview}
        previewCleanup={previewCleanup}
        retentionSettings={retentionSettings}
        runCleanup={runCleanup}
        saveRetentionSettings={saveRetentionSettings}
        setRetentionSettings={setRetentionSettings}
      />

      <div className="summary-card package-management-card">
        <div>
          <div className="summary-label">Pacotes e preços</div>
          <small className="summary-help">Crie, edite ou remova opções de venda sem alterar o fluxo do cliente.</small>
        </div>

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

      <PackageSettingsModal
        isOpen={isPackageEditorOpen}
        onClose={() => setIsPackageEditorOpen(false)}
        onSave={handleSavePackages}
        pricingOptions={pricingOptions}
        status={packageSettingsStatus}
      />

      <WatermarkSettingsPanel
        onSave={saveWatermarkSettings}
        settings={watermarkSettings}
        status={watermarkSettingsStatus}
      />

      <WhatsAppTemplatesPanel
        saveWhatsAppTemplates={saveWhatsAppTemplates}
        status={whatsAppTemplateStatus}
        templates={whatsAppTemplates}
      />
    </section>
  );
}
