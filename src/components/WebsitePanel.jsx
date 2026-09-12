import { useEffect, useRef, useState } from 'react';
import { useWebsiteAdmin } from '../hooks/useWebsiteAdmin';
import { websiteRequest } from '../lib/websiteApi';
import { CoverImage, GalleryCoverEditor } from './GalleryCoverControls';

function WebsiteLink({ url }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage('Link copiado.'); }
    catch { setMessage('Selecione o endereço e copie manualmente.'); }
  }
  return <section>
    <label htmlFor="website-url">Link do website</label>
    <div className="website-url"><input id="website-url" className="phone-input" readOnly value={url}
      onFocus={(event) => event.target.select()} /><button className="share-quick-btn" disabled={!url} onClick={copy}>Copiar link</button></div>
    <p role="status">{message}</p>
    {!url ? <p role="alert">Configure PUBLIC_WEBSITE_URL no servidor para compartilhar o website.</p> : null}
  </section>;
}

function WebsiteTypes({ settings, packages, save, busy }) {
  const [types, setTypes] = useState(settings.eligiblePackageTypes);
  useEffect(() => setTypes(settings.eligiblePackageTypes), [settings]);
  return <section><fieldset><legend>Tipos de galeria no website</legend>
    {Object.entries(packages).map(([key, value]) => <label key={key}>
      <input type="checkbox" checked={types.includes(key)} onChange={(event) => setTypes(event.target.checked
        ? [...types, key] : types.filter((type) => type !== key))} /> {value.shortLabel || key}
    </label>)}
  </fieldset><button className="share-quick-btn" disabled={busy || !types.length} onClick={() => save(types)}>Salvar tipos</button></section>;
}

function WebsiteSearchItem({ item, controls }) {
  const [editing, setEditing] = useState(false);
  return <div className="website-search-row">
    <span>{item.title || 'Galeria sem título'} — {item.eligible ? 'Disponível' : 'Não elegível'}</span>
    <button className="share-quick-btn" disabled={controls.busy || !item.eligible}
      onClick={() => controls.change(`/galleries/${encodeURIComponent(item.token)}`, 'POST')}>Adicionar ao website</button>
    <button className="share-quick-btn" onClick={() => setEditing(!editing)}>Editar capa de {item.title || 'galeria sem título'}</button>
    {editing ? <GalleryCoverEditor token={item.token} initialUrl={item.coverUrl} adminHeaders={controls.adminHeaders} onSaved={controls.refresh} /> : null}
  </div>;
}

function WebsiteGallerySearch({ adminHeaders, change, busy, revision, refresh }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ items: [], nextCursor: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  async function search(cursor = '') {
    const requestId = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ query, cursor, limit: '25' });
      const next = await websiteRequest(`/api/admin/website/galleries?${params}`, { headers: adminHeaders() });
      if (requestId !== sequence.current) return;
      setResult((old) => ({ ...next, items: cursor ? [...old.items, ...next.items] : next.items }));
    } catch (failure) { if (requestId === sequence.current) setError(failure.message); }
    finally { if (requestId === sequence.current) setLoading(false); }
  }
  useEffect(() => { sequence.current += 1; setLoading(false); setResult({ items: [], nextCursor: null }); }, [revision, query]);
  return <section><h3>Adicionar galeria existente</h3>
    <form onSubmit={(event) => { event.preventDefault(); search(); }} className="website-url">
      <input className="phone-input" aria-label="Buscar galerias" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome da galeria" />
      <button className="share-quick-btn" disabled={loading}>Buscar</button>
    </form>
    <small>Para publicar: título, capa, fotos, tipo habilitado e acesso ativo.</small>
    {error ? <p role="alert">{error}</p> : null}
    {result.items.map((item) => <WebsiteSearchItem key={item.token} item={item} controls={{ busy, change, adminHeaders, refresh }} />)}
    {result.nextCursor ? <button className="share-quick-btn" disabled={loading} onClick={() => search(result.nextCursor)}>Carregar mais galerias</button> : null}
  </section>;
}

function WebsiteEntry({ item, index, total, actions, adminHeaders }) {
  const [editing, setEditing] = useState(false);
  return <li className="website-entry">
    <CoverImage url={item.coverUrl} alt={item.title} />
    <div><strong>{index + 1}. {item.title}</strong><p>Visível no carrossel</p>
      <div className="website-entry-controls">
        <button className="share-quick-btn" aria-label={`Subir ${item.title}`} disabled={actions.busy || index === 0} onClick={() => actions.move(index, -1)}>↑</button>
        <button className="share-quick-btn" aria-label={`Descer ${item.title}`} disabled={actions.busy || index === total - 1} onClick={() => actions.move(index, 1)}>↓</button>
        <button className="share-quick-btn" onClick={() => setEditing(!editing)}>Editar capa</button>
        <button className="share-quick-btn" disabled={actions.busy} onClick={() => actions.remove(item.token)}>Remover do website</button>
        <a href={item.galleryUrl} target="_blank" rel="noreferrer">Abrir galeria</a>
      </div>
    </div>
    {editing ? <GalleryCoverEditor token={item.token} initialUrl={item.coverUrl} adminHeaders={adminHeaders} onSaved={actions.refresh} /> : null}
  </li>;
}

export function WebsitePanel({ adminHeaders }) {
  const state = useWebsiteAdmin(adminHeaders);
  const { data, error, busy, change, refresh } = state;
  function move(index, direction) {
    const tokens = data.galleries.map((item) => item.token);
    [tokens[index], tokens[index + direction]] = [tokens[index + direction], tokens[index]];
    change('/order', 'PUT', { tokens });
  }
  const actions = { busy, move, refresh, remove: (token) => change(`/galleries/${encodeURIComponent(token)}`, 'DELETE') };
  return <section className="admin-panel website-panel" aria-label="Website">
    <h2>Website</h2>
    {error ? <p role="alert">{error}</p> : null}
    <button className="share-quick-btn" onClick={refresh} disabled={busy}>Atualizar website</button>
    {!data ? <p>Carregando website…</p> : <>
      <WebsiteLink url={data.websiteUrl} />
      {!data.galleryBaseUrl ? <p role="alert">Configure a URL pública das galerias em Credenciais.</p> : null}
      {!data.contact.enabled ? <p role="alert">Cadastre um telefone comercial válido em Credenciais → Dados do fotógrafo.</p> : <p>WhatsApp: {data.contact.label}</p>}
      <WebsiteTypes settings={data.settings} packages={data.packages} busy={busy} save={(types) => change('/settings', 'PUT', { eligiblePackageTypes: types })} />
      <section><h3>Carrossel · {data.galleries.length}/10</h3>
        <p>Novas capas entram primeiro. A ordem manual é preservada; galerias removidas só voltam ao adicioná-las novamente.</p>
        <ol>{data.galleries.map((item, index) => <WebsiteEntry key={item.token} item={item} index={index}
          total={data.galleries.length} actions={actions} adminHeaders={adminHeaders} />)}</ol>
        {!data.galleries.length ? <p>Nenhuma galeria elegível no momento.</p> : null}
      </section>
      <WebsiteGallerySearch adminHeaders={adminHeaders} busy={busy} change={change} revision={data} refresh={refresh} />
    </>}
  </section>;
}
