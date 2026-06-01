import { useState } from 'react';
import { normalizeOverlaySettings } from '../hooks/useOverlaySettings';
import { OverlayPreviewModal } from './OverlayPreviewModal';

export function GalleryOverlaySection({
  applyGalleryOverlay = () => {},
  clearGalleryOverlay = () => {},
  detail = {},
  draft = {},
  isPhotoBusy,
  overlayAssets = [],
  previewUrl = '',
  shareSession,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const activeAssetId = detail.overlayAssetId || shareSession.overlayAssetId || '';
  const activeAsset = detail.overlayAsset || overlayAssets.find((asset) => asset.id === activeAssetId);
  const activeEnabled = Boolean(detail.overlayEnabled ?? shareSession.overlayEnabled);
  const draftAssetId = activeAssetId || draft.overlayAssetId;
  const draftSettings = normalizeOverlaySettings(detail.overlaySettings || shareSession.overlaySettings || draft.overlaySettings || {});
  const hasPhotos = Boolean(previewUrl);
  const statusLabel = activeAsset
    ? `${activeEnabled ? 'Ativo' : 'Inativo'}: ${activeAsset.identifier}`
    : 'Nenhum overlay configurado.';

  const saveOverlay = async (next) => {
    await applyGalleryOverlay(shareSession, next);
    setIsModalOpen(false);
  };

  return (
    <section className="gallery-preset-tools gallery-overlay-tools" aria-label="Overlay da galeria">
      <div>
        <strong>Overlay da galeria</strong>
        <small className="summary-help" style={{ display: 'block' }}>
          Aplique uma imagem por cima das previas desta galeria. Originais pagos continuam limpos.
        </small>
      </div>
      <small className={activeAsset && activeEnabled ? 'summary-help success' : 'summary-help'}>{statusLabel}</small>
      {activeAsset ? (
        <div className="gallery-watermark-preview">
          <img alt="" src={activeAsset.url} />
          <small>{activeAsset.identifier}</small>
        </div>
      ) : null}
      <div className="gallery-preset-actions">
        <button className="share-quick-btn approve-session-btn" disabled={isPhotoBusy || !hasPhotos || !overlayAssets.length} type="button" onClick={() => setIsModalOpen(true)}>
          {activeAsset ? 'Modificar' : 'Adicionar overlay'}
        </button>
        {activeAsset && !activeEnabled ? (
          <button className="share-quick-btn" disabled={isPhotoBusy} type="button" onClick={() => applyGalleryOverlay(shareSession, { assetId: activeAsset.id, enabled: true, settings: draftSettings })}>
            Ativar
          </button>
        ) : null}
        {activeAsset && activeEnabled ? (
          <button className="share-quick-btn" disabled={isPhotoBusy} type="button" onClick={() => applyGalleryOverlay(shareSession, { assetId: activeAsset.id, enabled: false, settings: draftSettings })}>
            Desativar
          </button>
        ) : null}
        {activeAsset ? (
          <button className="share-quick-btn share-quick-btn-danger" disabled={isPhotoBusy} type="button" onClick={() => clearGalleryOverlay(shareSession)}>
            Remover
          </button>
        ) : null}
      </div>
      {!hasPhotos ? <small className="summary-help">Adicione ao menos uma foto antes de configurar overlay.</small> : null}
      {!overlayAssets.length ? <small className="summary-help">Envie overlays em Configurações antes de usar nesta galeria.</small> : null}
      <OverlayPreviewModal
        assets={overlayAssets}
        initialAssetId={draftAssetId}
        initialSettings={draftSettings}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={saveOverlay}
        previewUrl={previewUrl}
      />
    </section>
  );
}
