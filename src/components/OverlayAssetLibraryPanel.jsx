import { Save, Sparkles, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { StoryOverlayProfileModal } from './StoryOverlayProfileModal';

export function OverlayAssetLibraryPanel({
  assets = [],
  deleteAsset,
  status = 'idle',
  updateAsset,
  uploadAsset,
}) {
  const [identifier, setIdentifier] = useState('');
  const [file, setFile] = useState(null);
  const [renameDrafts, setRenameDrafts] = useState({});
  const [storyAssetId, setStoryAssetId] = useState('');
  const isSaving = status === 'saving';
  const storyAsset = assets.find((asset) => asset.id === storyAssetId);

  const handleUpload = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file || !identifier.trim() || typeof uploadAsset !== 'function') return;
    const saved = await uploadAsset({ file, identifier });
    if (saved) {
      setIdentifier('');
      setFile(null);
      form.reset();
    }
  };

  return (
    <div className="watermark-asset-library overlay-asset-library">
      <form className="watermark-asset-upload" onSubmit={handleUpload}>
        <label>
          <span>Identificador</span>
          <input
            className="phone-input"
            maxLength={80}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Ex.: moldura-formatura"
            value={identifier}
          />
        </label>
        <label>
          <span>Imagem</span>
          <input
            accept="image/png,image/jpeg,image/webp"
            className="phone-input"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            type="file"
          />
        </label>
        <button className="btn-manual btn-manual-card watermark-save-button" disabled={isSaving || !file || !identifier.trim()} type="submit">
          <Upload size={16} />
          {isSaving ? 'Enviando...' : 'Enviar overlay'}
        </button>
      </form>

      {assets.length ? (
        <div className="watermark-asset-grid">
          {assets.map((asset) => {
            const draft = renameDrafts[asset.id] ?? asset.identifier;
            return (
              <article className="watermark-asset-card" key={asset.id}>
                <div className="watermark-asset-preview">
                  {asset.url ? <img alt="" src={asset.url} /> : null}
                </div>
                <div className="watermark-asset-meta">
                  <input
                    className="phone-input"
                    maxLength={80}
                    onChange={(event) => setRenameDrafts((previous) => ({ ...previous, [asset.id]: event.target.value }))}
                    value={draft}
                  />
                  <small>{asset.width}x{asset.height}px - {Math.round(Number(asset.sizeBytes || 0) / 1024)} KB</small>
                  <div className="watermark-asset-actions">
                    <button
                      className="share-quick-btn"
                      disabled={isSaving || draft === asset.identifier || !draft.trim()}
                      onClick={() => updateAsset(asset.id, { identifier: draft })}
                      type="button"
                    >
                      <Save size={14} />
                      Salvar
                    </button>
                    <button
                      className="share-quick-btn"
                      disabled={isSaving}
                      onClick={() => setStoryAssetId(asset.id)}
                      type="button"
                    >
                      <Sparkles size={14} />
                      Stories
                    </button>
                    <button
                      className="share-quick-btn share-quick-btn-danger"
                      disabled={isSaving}
                      onClick={() => deleteAsset(asset.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                      Deletar
                    </button>
                  </div>
                  <small className={asset.storyConfigured ? 'summary-help success' : 'summary-help'}>
                    {asset.storyConfigured ? 'Stories 9:16 configurado.' : 'Stories 9:16 pendente.'}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="share-gallery-empty">Nenhum overlay enviado ainda.</div>
      )}
      <StoryOverlayProfileModal
        asset={storyAsset}
        initialSettings={storyAsset?.storySettings || {}}
        isOpen={Boolean(storyAsset)}
        onClose={() => setStoryAssetId('')}
        onSave={async (storySettings) => {
          const updated = await updateAsset(storyAsset.id, { storySettings });
          if (updated) setStoryAssetId('');
        }}
      />
    </div>
  );
}
