import { API_BASE_URL, buildApiErrorMessage, readJsonResponse } from '../lib/apiClient';
import { normalizePhotoUrl, photoIdFromUrl } from '../lib/photos';
import { firstPackageKey } from '../lib/pricing';
import { buildShareWhatsAppMessage, normalizeShareCode } from '../lib/share';
import { createSessionId } from '../lib/session';

export function useSnapFlowActions(config) {
  const {
    adminHeaders,
    adminJsonHeaders,
    clientName,
    clientEmail,
    clientPhone,
    count,
    fetchDashboard,
    selectedPhotoItems,
    sessionId,
    setBrokenPhotoIds,
    setClientName,
    setClientEmail = () => {},
    setClientPhone,
    setIsGeneratingPix,
    setIsUploading,
    setLiveOps,
    setNotice,
    setPhotos,
    setPixCopyPaste,
    setPixWhatsAppMessage = () => {},
    setQrCodeBase64,
    setScreen,
    setSelected,
    setSessionId,
    setShareAccess,
    setShareActionLoading,
    setType,
    setViewerIndex,
    shareAccess,
    shareCodeInput,
    shareDurationMinutes,
    shareSessionInfo,
    shareToken,
    pricingOptions,
    total,
    type,
    withAdminMediaToken,
  } = config;

  const markBrokenPhoto = (photoId) => {
    setBrokenPhotoIds((previous) =>
      previous.includes(photoId) ? previous : [...previous, photoId]
    );
  };

  const resetSession = () => {
    setPhotos([]);
    setSelected([]);
    setSessionId('');
    setQrCodeBase64('');
    setPixCopyPaste('');
    setPixWhatsAppMessage('');
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setViewerIndex(null);
    setBrokenPhotoIds([]);
    setNotice(null);
    setLiveOps({
      paymentStatus: 'draft',
      deliveryStatus: 'idle',
      deliveryError: null,
      paymentMethod: null,
    });
  };

  const startNewSession = () => {
    document.getElementById('hidden-upload')?.click();
  };

  const handleFileUpload = async (event) => {
    const { files } = event.target;
    if (!files || !files.length) return;

    setIsUploading(true);
    const formData = new FormData();
    const filesArray = Array.from(files);

    for (let index = 0; index < filesArray.length; index += 1) {
      formData.append('photos', filesArray[index]);
    }

    try {
      const response = await fetch(API_BASE_URL + '/api/admin/upload', {
        method: 'POST',
        headers: adminHeaders(),
        body: formData,
      });

      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage('Erro ao enviar fotos para o servidor.', response, data));
      }

      if (Array.isArray(data.photos) && data.photos.length > 0) {
        const uploadedPhotos = data.photos.map((photo, index) => {
          const normalizedUrl = normalizePhotoUrl(withAdminMediaToken(photo.url));
          const thumbUrl = normalizePhotoUrl(withAdminMediaToken(photo.thumbUrl || photo.url));
          return {
            id: photo.id || photoIdFromUrl(normalizedUrl, index),
            url: normalizedUrl,
            thumbUrl: thumbUrl || normalizedUrl,
          };
        });

        setPhotos(uploadedPhotos);
        setSelected([]);
        setBrokenPhotoIds([]);
        setQrCodeBase64('');
        setPixCopyPaste('');
        setPixWhatsAppMessage('');
        setSessionId('');
        setClientName('');
        setClientEmail('');
        setClientPhone('');
        setViewerIndex(null);
        setLiveOps({
          paymentStatus: 'draft',
          deliveryStatus: 'idle',
          deliveryError: null,
          paymentMethod: null,
        });
        setScreen('gallery');
      } else {
        setNotice('Upload concluído, mas o servidor não retornou fotos processadas.');
      }
    } catch (error) {
      console.error('Falha no upload:', error);
      setNotice(error.message || 'Erro ao enviar fotos para o servidor.');
    } finally {
      event.target.value = '';
      setIsUploading(false);
    }
  };

  const handleGeneratePix = async () => {
    setIsGeneratingPix(true);

    try {
      const generatedId = createSessionId();
      setSessionId(generatedId);

      const payload = {
        total,
        count,
        sessionId: generatedId,
        phone: clientPhone,
        clientName,
        clientEmail,
        photoIds: selectedPhotoItems.map((photo) => photo.id),
        packageType: type,
      };
      const endpoint = shareToken
        ? API_BASE_URL + '/api/share-session/' + shareToken + '/pix'
        : API_BASE_URL + '/api/admin/pix';
      const headers = shareToken
        ? {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${shareAccess?.customerAccessToken || ''}`,
          }
        : adminJsonHeaders();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse(response);

      if (response.ok && data.qr_code_base64) {
        setQrCodeBase64(data.qr_code_base64);
        setPixCopyPaste(data.qr_code || '');
        setPixWhatsAppMessage(data.whatsappMessage || '');
        setLiveOps({
          paymentStatus: 'pending',
          deliveryStatus: 'idle',
          deliveryError: null,
          paymentMethod: 'PIX',
        });
        setScreen('pix');
      } else {
        alert('Erro ao gerar Pix: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Falha ao gerar Pix:', error);
      alert('Erro no backend: a API não respondeu como esperado.');
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleManualPayment = async (paymentMethod) => {
    setIsGeneratingPix(true);

    try {
      const generatedId = sessionId || createSessionId();
      setSessionId(generatedId);
      const endpoint = shareToken
        ? API_BASE_URL + '/api/share-session/' + shareToken + '/manual-payment'
        : API_BASE_URL + '/api/admin/manual-payment';
      const headers = shareToken
        ? {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${shareAccess?.customerAccessToken || ''}`,
          }
        : adminJsonHeaders();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          total,
          count,
          sessionId: generatedId,
          phone: clientPhone,
          clientName,
          clientEmail,
          photoIds: selectedPhotoItems.map((photo) => photo.id),
          packageType: type,
          paymentMethod,
          isShareSession: Boolean(shareToken),
          shareToken,
          accessCode: shareSessionInfo?.accessCode,
        }),
      });

      const data = await readJsonResponse(response);

      if (response.ok && data.status === 'approved') {
        setLiveOps({
          paymentStatus: 'approved',
          deliveryStatus: data.deliveryStatus || 'queued',
          deliveryError: null,
          paymentMethod: 'Dinheiro/Cartão',
        });
        setNotice('Pagamento em dinheiro/cartão confirmado pelo fotógrafo e fotos liberadas.');
      } else if (response.ok && data.status === 'pending') {
        setSessionId(data.sessionId || generatedId);
        setLiveOps({
          paymentStatus: 'pending',
          deliveryStatus: 'idle',
          deliveryError: null,
          paymentMethod: 'Dinheiro/Cartão',
        });
        setNotice('Pagamento em dinheiro/cartão aguardando liberação no painel.');
        setScreen('manual-pending');
        return;
      } else {
        alert('Não foi possível registrar o pagamento: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Falha ao registrar pagamento manual:', error);
      alert('Não foi possível registrar o pagamento manual.');
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const applySharedSession = (data) => {
    const sharedPhotos = Array.isArray(data.photos)
      ? data.photos.map((item, index) => {
          const rawUrl = typeof item === 'string' ? item : item?.url;
          const rawThumbUrl =
            typeof item === 'string' ? data.thumbUrls?.[index] : item?.thumbUrl || data.thumbUrls?.[index];
          const normalizedUrl = normalizePhotoUrl(rawUrl);
          const normalizedThumbUrl = rawThumbUrl ? normalizePhotoUrl(rawThumbUrl) : '';
          return {
            id: item?.id || photoIdFromUrl(rawUrl, index),
            url: normalizedUrl,
            thumbUrl: normalizedThumbUrl || normalizedUrl,
          };
        })
      : [];

    setPhotos(sharedPhotos);
    setSelected([]);
    setBrokenPhotoIds([]);
    setQrCodeBase64('');
    setSessionId('');
    setClientName(data.clientName || '');
    setClientEmail(data.clientEmail || '');
    setClientPhone(data.phone || '');
    setType(pricingOptions[data.packageType] ? data.packageType : firstPackageKey(pricingOptions));
    setShareAccess({
      token: shareToken,
      customerAccessToken: data.customerAccessToken,
      expiresAt: data.expiresAt,
      link: data.link,
    });
    setViewerIndex(null);
    setLiveOps({
      paymentStatus: 'draft',
      deliveryStatus: 'idle',
      deliveryError: null,
      paymentMethod: null,
    });
    setScreen('gallery');
  };

  const handleUnlockSharedSession = async () => {
    if (!shareToken) return;
    const code = normalizeShareCode(shareCodeInput);
    if (code.length !== 4) {
      setNotice('Digite o código de 4 caracteres.');
      return;
    }

    setShareActionLoading(true);

    try {
      const response = await fetch(API_BASE_URL + '/api/share-session/' + shareToken + '/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível abrir o link.');
      }

      applySharedSession(data);
      setNotice('Galeria compartilhada aberta.');
    } catch (error) {
      setNotice(error.message || 'Não foi possível abrir a galeria.');
    } finally {
      setShareActionLoading(false);
    }
  };

  const handleCreateShareSession = async () => {
    if (!selectedPhotoItems.length) {
      setNotice('Selecione ao menos uma foto para gerar o link.');
      return;
    }

    setShareActionLoading(true);

    try {
      const response = await fetch(API_BASE_URL + '/api/admin/share-session', {
        method: 'POST',
        headers: adminJsonHeaders(),
        body: JSON.stringify({
          photoIds: selectedPhotoItems.map((photo) => photo.id),
          phone: clientPhone,
          clientName,
          clientEmail,
          packageType: type,
          count,
          total,
          expiresMinutes: shareDurationMinutes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível gerar o link.');
      }

      const link = data.link || window.location.origin + '/s/' + data.token;
      const shareRecord = {
        token: data.token,
        code: data.accessCode,
        link,
        expiresAt: data.expiresAt,
        clientName: data.clientName || clientName,
        clientEmail: data.clientEmail || clientEmail,
        whatsappMessage: data.whatsappMessage || buildShareWhatsAppMessage(link, data.accessCode),
      };

      setShareAccess(shareRecord);
      if (data.whatsappSent) {
        setNotice('Link criado e enviado no WhatsApp.');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareRecord.whatsappMessage);
        setNotice('Link criado, mas WhatsApp não enviou. Mensagem copiada para envio manual.');
      } else {
        setNotice('Link criado, mas WhatsApp não enviou. Use Copiar mensagem WhatsApp para envio manual.');
      }
      fetchDashboard?.({ silent: true });
    } catch (error) {
      setNotice(error.message || 'Não foi possível gerar o link.');
    } finally {
      setShareActionLoading(false);
    }
  };

  const handleExtendShareSession = async () => {
    if (!shareAccess?.token) return;

    setShareActionLoading(true);

    try {
      const response = await fetch(API_BASE_URL + '/api/admin/share-sessions/' + shareAccess.token + '/extend', {
        method: 'POST',
        headers: adminJsonHeaders(),
        body: JSON.stringify({ minutes: 15 }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível estender o acesso.');
      }

      setShareAccess((previous) => ({
        ...previous,
        expiresAt: data.expiresAt,
      }));
      setNotice('Acesso estendido por mais 15 minutos.');
    } catch (error) {
      setNotice(error.message || 'Não foi possível estender o acesso.');
    } finally {
      setShareActionLoading(false);
    }
  };

  const handleRevokeShareSession = async () => {
    if (!shareAccess?.token) return;

    setShareActionLoading(true);

    try {
      const response = await fetch(API_BASE_URL + '/api/admin/share-sessions/' + shareAccess.token + '/revoke', {
        method: 'POST',
        headers: adminJsonHeaders(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível revogar o acesso.');
      }

      setNotice('Acesso revogado.');
      setShareAccess((previous) =>
        previous
          ? {
              ...previous,
              revokedAt: data.revokedAt,
            }
          : previous
      );
    } catch (error) {
      setNotice(error.message || 'Não foi possível revogar o acesso.');
    } finally {
      setShareActionLoading(false);
    }
  };

  return {
    handleCreateShareSession,
    handleExtendShareSession,
    handleFileUpload,
    handleGeneratePix,
    handleManualPayment,
    handleRevokeShareSession,
    handleUnlockSharedSession,
    markBrokenPhoto,
    resetSession,
    startNewSession,
  };
}
