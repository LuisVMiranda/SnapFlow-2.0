import { useState } from 'react';
import { ShareCountdown } from './ShareCountdown';
import { ShareGalleryEditor } from './ShareGalleryEditor';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';
import { formatMoney } from '../lib/formatters';
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
    clientName: shareSession.clientName || '',
    clientEmail: shareSession.clientEmail || '',
    discountAmount: String(shareSession.discountAmount ?? ''),
    expiresMinutes: '',
    galleryDescription: shareSession.galleryDescription || '',
    galleryName: shareSession.galleryName || '',
    packageType: shareSession.packageType || '',
    phone: shareSession.phone || '',
    subtotal: String(shareSession.subtotal ?? shareSession.total ?? ''),
  };
}

function gallerySalesLabel(shareSession) {
  const sales = shareSession?.sales || {};
  const soldPhotoCount = Number(sales.soldPhotoCount || 0);
  const soldOrderCount = Number(sales.soldOrderCount || 0);
  const soldAmount = Number(sales.soldAmount || 0);
  return `${soldPhotoCount} foto(s) vendidas até agora em ${soldOrderCount} pedido(s) - ${formatMoney(soldAmount)}`;
}

function galleryRouteErrorMessage(prefix, response, data) {
  const message = buildApiErrorMessage(prefix, response, data);
  return data?.code === 'api_route_not_found'
    ? `${message} Backend desatualizado. Reinicie o servidor para carregar as rotas de galeria.`
    : message;
}

export function SharedLinksPanel({
  adminHeaders,
  adminJsonHeaders,
  dashData,
  fetchDashboard,
  pricingOptions,
  setNotice,
  withAdminMediaToken = (url) => url,
}) {
  const [editingToken, setEditingToken] = useState('');
  const [drafts, setDrafts] = useState({});
  const [details, setDetails] = useState({});
  const [loadingDetailsToken, setLoadingDetailsToken] = useState('');
  const [photoActionToken, setPhotoActionToken] = useState('');

  const normalizeDetails = (data) => ({
    ...data,
    photosPage: data.photosPage || { hasMore: false, nextCursor: null, loadedCount: 0, totalCount: data.photoCount || 0 },
    photos: Array.isArray(data.photos)
      ? data.photos.map((photo) => ({
          ...photo,
          url: withAdminMediaToken(photo.url),
          thumbUrl: withAdminMediaToken(photo.thumbUrl || photo.url),
        }))
      : [],
  });

  const mergeDetailPhotos = (currentPhotos = [], nextPhotos = []) => {
    const seen = new Set();
    return [...currentPhotos, ...nextPhotos].filter((photo) => {
      if (!photo?.id || seen.has(photo.id)) return false;
      seen.add(photo.id);
      return true;
    });
  };

  const loadShareDetails = async (shareSession) => {
    setLoadingDetailsToken(shareSession.token);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}`, {
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(galleryRouteErrorMessage('Não foi possível carregar a galeria.', response, data));
        return null;
      }
      const normalized = normalizeDetails(data);
      setDetails((previous) => ({ ...previous, [shareSession.token]: normalized }));
      return normalized;
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível carregar a galeria.', error));
      return null;
    } finally {
      setLoadingDetailsToken('');
    }
  };

  const loadMoreSharePhotos = async (shareSession) => {
    const current = details[shareSession.token];
    if (!current?.photosPage?.hasMore || loadingDetailsToken === shareSession.token) return;
    setLoadingDetailsToken(shareSession.token);
    try {
      const params = new URLSearchParams();
      if (current.photosPage.nextCursor) params.set('cursor', current.photosPage.nextCursor);
      if (current.photosPage.limit) params.set('limit', String(current.photosPage.limit));
      const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/photos?${params.toString()}`, {
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(galleryRouteErrorMessage('Não foi possível carregar mais fotos da galeria.', response, data));
        return;
      }
      const normalized = normalizeDetails(data);
      setDetails((previous) => ({
        ...previous,
        [shareSession.token]: {
          ...current,
          photos: mergeDetailPhotos(current.photos, normalized.photos),
          photosPage: normalized.photosPage,
        },
      }));
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível carregar mais fotos da galeria.', error));
    } finally {
      setLoadingDetailsToken('');
    }
  };

  const updateDraft = (token, field, value) => {
    setDrafts((previous) => ({
      ...previous,
      [token]: {
        ...previous[token],
        [field]: field === 'accessCode' ? normalizeShareCode(value) : value,
      },
    }));
  };

  const startEditing = async (shareSession) => {
    const isClosing = editingToken === shareSession.token;
    setEditingToken(isClosing ? '' : shareSession.token);
    setDrafts((previous) => ({
      ...previous,
      [shareSession.token]: previous[shareSession.token] || draftFromShare(shareSession),
    }));
    if (!isClosing) await loadShareDetails(shareSession);
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
    try {
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
      setNotice('Galeria revalidada com o mesmo link e código. A mensagem foi copiada.');
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível recriar a galeria.', error));
    }
  };

  const deleteShare = async (shareSession) => {
    if (!window.confirm('Deseja deletar esta galeria da lista? Os arquivos continuarão sob a política de retenção.')) return;
    try {
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
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível deletar a galeria.', error));
    }
  };

  const extendShare = async (shareSession) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/extend`, {
        method: 'POST',
        headers: adminJsonHeaders(),
        body: JSON.stringify({ minutes: 15 }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível estender a galeria.', response, data));
        return;
      }
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível estender a galeria.', error));
    }
  };

  const revokeShare = async (shareSession) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/revoke`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível revogar a galeria.', response, data));
        return;
      }
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível revogar a galeria.', error));
    }
  };

  const uploadPhotos = async (event, shareSession) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));

    setPhotoActionToken(shareSession.token);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/photos`, {
        method: 'POST',
        headers: adminHeaders(),
        body: formData,
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(galleryRouteErrorMessage('Não foi possível adicionar fotos.', response, data));
        return;
      }
      setDetails((previous) => ({ ...previous, [shareSession.token]: normalizeDetails(data) }));
      setNotice('Fotos adicionadas à galeria.');
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível adicionar fotos.', error));
    } finally {
      event.target.value = '';
      setPhotoActionToken('');
    }
  };

  const deletePhoto = async (shareSession, photo) => {
    if (!window.confirm('Remover esta foto da galeria? O arquivo será excluído do armazenamento local.')) return;
    setPhotoActionToken(shareSession.token);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/photos/${photo.id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(galleryRouteErrorMessage('Não foi possível remover a foto.', response, data));
        return;
      }
      await loadShareDetails(shareSession);
      setNotice('Foto removida da galeria.');
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível remover a foto.', error));
    } finally {
      setPhotoActionToken('');
    }
  };

  const saveShare = async (event, shareSession) => {
    event.preventDefault();
    const draft = drafts[shareSession.token] || draftFromShare(shareSession);
    const subtotalRaw = String(draft.subtotal ?? '').trim();
    const discountRaw = String(draft.discountAmount ?? '').trim();
    const subtotal = subtotalRaw === '' ? NaN : Number(draft.subtotal);
    const discountAmount = discountRaw === '' ? NaN : Number(draft.discountAmount);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      setNotice('Informe um subtotal válido para a galeria. Use zero apenas se a venda realmente não tiver valor base.');
      return;
    }
    if (discountRaw !== '' && (!Number.isFinite(discountAmount) || discountAmount <= 0)) {
      setNotice('Informe um desconto em dinheiro maior que zero ou deixe o campo em branco para remover o desconto manual.');
      return;
    }
    if (discountRaw !== '' && discountAmount > subtotal) {
      setNotice('O desconto não pode ser maior que o subtotal configurado para esta galeria.');
      return;
    }
    if (discountRaw !== '' && subtotal > 0 && discountAmount === subtotal && !window.confirm('Esse desconto deixa a galeria gratuita para o cliente. Deseja salvar mesmo assim?')) {
      return;
    }
    const body = {
      clientName: draft.clientName,
      clientEmail: draft.clientEmail,
      discountAmount: discountRaw === '' ? '' : discountAmount,
      galleryName: draft.galleryName,
      galleryDescription: draft.galleryDescription,
      packageType: draft.packageType,
      phone: draft.phone,
      subtotal,
    };
    if (draft.accessCode) body.accessCode = draft.accessCode;
    if (draft.expiresMinutes) body.expiresMinutes = Number(draft.expiresMinutes);

    try {
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
      await loadShareDetails(shareSession);
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível salvar a galeria.', error));
    }
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
          <div key={shareSession.galleryId || shareSession.token} className="session-item share-session-item">
            <div className="session-info">
              <strong>{shareSession.galleryName || packageLabel(shareSession.packageType, pricingOptions)}</strong>
              <small>
                {shareSession.photoCount} foto(s) • código {shareSession.accessCode || 'não definido'}
              </small>
              {shareSession.galleryDescription ? <small>{shareSession.galleryDescription}</small> : null}
              {shareSession.clientName ? <small>Cliente: {shareSession.clientName}</small> : null}
              {shareSession.clientEmail ? <small>E-mail: {shareSession.clientEmail}</small> : null}
              {Number(shareSession.discountAmount || 0) > 0 ? <small>Desconto manual: {formatMoney(shareSession.discountAmount)}</small> : null}
              <small>{gallerySalesLabel(shareSession)}</small>
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
              <ShareGalleryEditor
                closeEditor={() => setEditingToken('')}
                deletePhoto={deletePhoto}
                detail={details[shareSession.token]}
                draft={draft}
                isLoading={loadingDetailsToken === shareSession.token}
                isPhotoBusy={photoActionToken === shareSession.token}
                loadMorePhotos={loadMoreSharePhotos}
                pricingOptions={pricingOptions}
                saveShare={saveShare}
                shareSession={shareSession}
                updateDraft={updateDraft}
                uploadPhotos={uploadPhotos}
              />
            ) : null}
          </div>
        );
      })}

      {dashData.shareRecent?.length === 0 ? <div className="empty-state">Nenhum link compartilhado ainda</div> : null}
    </div>
  );
}
