import { useEffect, useId, useState } from 'react';
import { uploadGalleryCover, websiteRequest } from '../lib/websiteApi';
import '../styles/website-admin.css';

export function CoverImage({ url, alt = 'Capa da galeria', className = 'gallery-cover-preview' }) {
  const [failedUrl, setFailedUrl] = useState('');
  if (!url || failedUrl === url) return null;
  return <img className={className} src={url} alt={alt} onError={() => setFailedUrl(url)} />;
}

export function CoverFileInput({ onChange, disabled = false }) {
  const id = useId();
  return <label htmlFor={id}>Imagem de capa (JPG, PNG, WebP ou HEIC)
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
      disabled={disabled} onChange={(event) => { onChange(event.target.files?.[0] || null); event.target.value = ''; }} />
    <small className="summary-help">Imagem pública, também exibida antes do código de acesso. Prefira uma foto vertical.</small>
  </label>;
}

export function GalleryIdentityFields({ draft, onChange }) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!draft.file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(draft.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.file]);
  return <section className="summary-card gallery-identity" aria-label="Identidade da galeria">
    <label>Nome da galeria<input className="phone-input" maxLength={120} value={draft.galleryName}
      onChange={(event) => onChange({ ...draft, galleryName: event.target.value })} /></label>
    <label>Descrição da galeria<textarea className="phone-input" maxLength={800} value={draft.galleryDescription}
      onChange={(event) => onChange({ ...draft, galleryDescription: event.target.value })} /></label>
    <CoverFileInput onChange={(file) => onChange({ ...draft, file })} />
    <CoverImage url={preview} />
    {draft.file ? <button type="button" className="share-quick-btn" onClick={() => onChange({ ...draft, file: null })}>Limpar seleção da capa</button> : null}
  </section>;
}

export function GalleryCoverEditor({ token, initialUrl = '', adminHeaders, onSaved = () => {} }) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setUrl(initialUrl), [initialUrl, token]);
  async function change(file) {
    setBusy(true);
    setError('');
    try {
      const result = file ? await uploadGalleryCover(token, file, adminHeaders)
        : await websiteRequest(`/api/admin/share-sessions/${encodeURIComponent(token)}/cover`, { method: 'DELETE', headers: adminHeaders() });
      setUrl(result.coverUrl);
      await onSaved();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="gallery-cover-editor" aria-label="Capa da galeria">
    <CoverImage url={url} />
    <CoverFileInput disabled={busy} onChange={(file) => { if (file) change(file); }} />
    {url ? <button className="share-quick-btn" type="button" disabled={busy} onClick={() => change(null)}>Remover capa</button> : null}
    {busy ? <p role="status">Atualizando capa…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}

export function CoverUploadRetry({ creation }) {
  if (!creation.pending) return null;
  return <aside className="cover-retry summary-card" role="alert">
    <p>A galeria foi salva, mas a capa não foi enviada. {creation.error}</p>
    <button className="btn-primary" disabled={creation.busy} onClick={creation.retry}>Tentar enviar capa novamente</button>
  </aside>;
}
