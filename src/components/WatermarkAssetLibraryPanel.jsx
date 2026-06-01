import { Save, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';

export function WatermarkAssetLibraryPanel({
  assets = [],
  deleteAsset,
  status = 'idle',
  updateAsset,
  uploadAsset,
}) {
  const [assetName, setAssetName] = useState('');
  const [file, setFile] = useState(null);
  const [renameDrafts, setRenameDrafts] = useState({});
  const isSaving = status === 'saving';

  const handleUpload = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file || typeof uploadAsset !== 'function') return;
    const saved = await uploadAsset({ file, name: assetName });
    if (saved) {
      setAssetName('');
      setFile(null);
      form.reset();
    }
  };

  return (
    <div className="watermark-asset-library">
      <form className="watermark-asset-upload" onSubmit={handleUpload}>
        <label>
          <span>Nome</span>
          <input
            className="phone-input"
            maxLength={80}
            onChange={(event) => setAssetName(event.target.value)}
            placeholder="Ex.: Logo da formatura"
            value={assetName}
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
        <button className="btn-manual btn-manual-card watermark-save-button" disabled={isSaving || !file} type="submit">
          <Upload size={16} />
          {isSaving ? 'Enviando...' : "Enviar marca d'água"}
        </button>
      </form>

      {assets.length ? (
        <div className="watermark-asset-grid">
          {assets.map((asset) => {
            const draft = renameDrafts[asset.id] ?? asset.name;
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
                      disabled={isSaving || draft === asset.name}
                      onClick={() => updateAsset(asset.id, { name: draft })}
                      type="button"
                    >
                      <Save size={14} />
                      Salvar
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
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="share-gallery-empty">Nenhuma marca d'água enviada ainda.</div>
      )}
    </div>
  );
}
