import { useState } from 'react';
import { ShareCountdown } from './ShareCountdown';
import { API_BASE_URL, buildApiErrorMessage, readJsonResponse } from '../lib/apiClient';
import { packageLabel } from '../lib/pricing';
import { buildShareWhatsAppMessage, normalizeShareCode } from '../lib/share';

function statusMeta(status) {
  if (status === 'revoked') return { label: 'Revogado', tone: 'danger' };
  if (status === 'expired') return { label: 'Expirado', tone: 'neutral' };
  if (status === 'opened') return { label: 'Aberto', tone: 'success' };
  return { label: 'Ativo', tone: 'info' };
}

function shareLink(shareSession) {
  return shareSession.link || `${window.location.origin}/s/${shareSession.token}`;
}

function draftFromShare(shareSession) {
  return {
    accessCode: shareSession.accessCode || '',
    expiresMinutes: '',
    packageType: shareSession.packageType || '',
    phone: shareSession.phone || '',
    total: String(shareSession.total ?? ''),
  };
}

export function SharedLinksPanel({
  adminHeaders,
  adminJsonHeaders,
  dashData,
  fetchDashboard,
  pricingOptions,
  setNotice,
}) {
  const [editingToken, setEditingToken] = useState('');
  const [drafts, setDrafts] = useState({});

  const updateDraft = (token, field, value) => {
    setDrafts((previous) => ({
      ...previous,
      [token]: {
        ...previous[token],
        [field]: field === 'accessCode' ? normalizeShareCode(value) : value,
      },
    }));
  };

  const startEditing = (shareSession) => {
    setEditingToken((current) => (current === shareSession.token ? '' : shareSession.token));
    setDrafts((previous) => ({
      ...previous,
      [shareSession.token]: previous[shareSession.token] || draftFromShare(shareSession),
    }));
  };

  const copyShare = async (shareSession) => {
    const link = shareLink(shareSession);
    const text = shareSession.accessCode ? buildShareWhatsAppMessage(link, shareSession.accessCode) : link;
    await navigator.clipboard?.writeText(text);
    setNotice(shareSession.accessCode ? 'Mensagem da galeria copiada.' : 'Link copiado. Defina o código para copiar a mensagem completa.');
  };

  const openShare = (shareSession) => {
    window.open(shareLink(shareSession), '_blank', 'noopener,noreferrer');
  };

  const recreateShare = async (shareSession) => {
    const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/recreate`, {
      method: 'POST',
      headers: adminHeaders(),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) {
      setNotice(buildApiErrorMessage('Não foi possível recriar a galeria.', response, data));
      return;
    }

    const message = data.whatsappMessage || buildShareWhatsAppMessage(data.link, data.accessCode);
    await navigator.clipboard?.writeText(message);
    setNotice('Galeria recriada com o mesmo código. A nova mensagem foi copiada.');
    fetchDashboard({ silent: true });
  };

  const deleteShare = async (shareSession) => {
    if (!window.confirm('Deseja deletar esta galeria da lista? Os arquivos continuarão sob a política de retenção.')) return;
    const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}`, {
      method: 'DELETE',
      headers: adminJsonHeaders(),
      body: JSON.stringify({}),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) {
      setNotice(buildApiErrorMessage('Não foi possível deletar a galeria.', response, data));
      return;
    }
    setNotice('Galeria removida da lista.');
    fetchDashboard({ silent: true });
  };

  const extendShare = async (shareSession) => {
    await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/extend`, {
      method: 'POST',
      headers: adminJsonHeaders(),
      body: JSON.stringify({ minutes: 15 }),
    });
    fetchDashboard({ silent: true });
  };

  const revokeShare = async (shareSession) => {
    await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/revoke`, {
      method: 'POST',
      headers: adminHeaders(),
    });
    fetchDashboard({ silent: true });
  };

  const saveShare = async (event, shareSession) => {
    event.preventDefault();
    const draft = drafts[shareSession.token] || draftFromShare(shareSession);
    const body = {
      packageType: draft.packageType,
      phone: draft.phone,
      total: draft.total === '' ? undefined : Number(draft.total),
    };
    if (draft.accessCode) body.accessCode = draft.accessCode;
    if (draft.expiresMinutes) body.expiresMinutes = Number(draft.expiresMinutes);

    const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}`, {
      method: 'PATCH',
      headers: adminJsonHeaders(),
      body: JSON.stringify(body),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) {
      setNotice(buildApiErrorMessage('Não foi possível salvar a galeria.', response, data));
      return;
    }
    setNotice('Galeria atualizada.');
    setEditingToken('');
    fetchDashboard({ silent: true });
  };

  return (
    <div className="recent-sessions">
      <div className="recent-header">
        <h3>Links compartilhados</h3>
      </div>

      {dashData.shareRecent?.map((shareSession) => {
        const meta = statusMeta(shareSession.status);
        const inactive = shareSession.status === 'revoked' || shareSession.status === 'expired';
        const draft = drafts[shareSession.token] || draftFromShare(shareSession);
        const isEditing = editingToken === shareSession.token;

        return (
          <div key={shareSession.token} className="session-item share-session-item">
            <div className="session-info">
              <strong>{packageLabel(shareSession.packageType, pricingOptions)}</strong>
              <small>
                {shareSession.photoCount} foto(s) • código {shareSession.accessCode || 'não definido'}
              </small>
              <small>
                Expira em <ShareCountdown isoDate={shareSession.expiresAt} />
              </small>
            </div>
            <div className="session-status" style={{ gap: '8px' }}>
              <span className={`badge badge-${meta.tone}`}>{meta.label}</span>
              <div className="share-quick-actions">
                <button className="share-quick-btn" type="button" onClick={() => startEditing(shareSession)}>Ver/Editar</button>
                <button className="share-quick-btn" type="button" onClick={() => openShare(shareSession)}>Abrir</button>
                <button className="share-quick-btn" type="button" onClick={() => copyShare(shareSession)}>Copiar</button>
                {inactive ? (
                  <button className="share-quick-btn" type="button" onClick={() => recreateShare(shareSession)}>Recriar</button>
                ) : (
                  <>
                    <button className="share-quick-btn" type="button" onClick={() => extendShare(shareSession)}>+15</button>
                    <button className="share-quick-btn share-quick-btn-danger" type="button" onClick={() => revokeShare(shareSession)}>Revogar</button>
                  </>
                )}
                <button className="share-quick-btn share-quick-btn-danger" type="button" onClick={() => deleteShare(shareSession)}>Deletar</button>
              </div>
            </div>

            {isEditing ? (
              <form className="share-edit-panel" onSubmit={(event) => saveShare(event, shareSession)}>
                <label>
                  Código de acesso
                  <input
                    className="phone-input"
                    maxLength={4}
                    value={draft.accessCode}
                    onChange={(event) => updateDraft(shareSession.token, 'accessCode', event.target.value)}
                    placeholder="1234"
                  />
                </label>
                <label>
                  WhatsApp
                  <input
                    className="phone-input"
                    value={draft.phone}
                    onChange={(event) => updateDraft(shareSession.token, 'phone', event.target.value)}
                    placeholder="DDD + número"
                  />
                </label>
                <label>
                  Pacote
                  <select
                    className="phone-input"
                    value={draft.packageType}
                    onChange={(event) => updateDraft(shareSession.token, 'packageType', event.target.value)}
                  >
                    {Object.entries(pricingOptions).map(([key, option]) => (
                      <option key={key} value={key}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Total
                  <input
                    className="phone-input"
                    min="0"
                    step="0.01"
                    type="number"
                    value={draft.total}
                    onChange={(event) => updateDraft(shareSession.token, 'total', event.target.value)}
                  />
                </label>
                <label>
                  Reabrir por minutos
                  <input
                    className="phone-input"
                    min="5"
                    max="180"
                    type="number"
                    value={draft.expiresMinutes}
                    onChange={(event) => updateDraft(shareSession.token, 'expiresMinutes', event.target.value)}
                    placeholder="Deixe vazio para manter"
                  />
                </label>
                <div className="share-edit-actions">
                  <button className="btn-primary" type="submit">Salvar galeria</button>
                  <button className="btn-manual btn-manual-card" type="button" onClick={() => setEditingToken('')}>Cancelar</button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}

      {dashData.shareRecent?.length === 0 ? <div className="empty-state">Nenhum link compartilhado ainda</div> : null}
    </div>
  );
}
