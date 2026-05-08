import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';
import { resolveInitialScreen } from '../lib/navigation';
import { DEFAULT_PRICING, calcTotal, firstPackageKey } from '../lib/pricing';
import { detectShareToken } from '../lib/share';
import { NoticeBanner } from '../components/NoticeBanner';
import { useAdminAccess } from './useAdminAccess';
import { useDashboardPolling } from './useDashboardPolling';
import { useCredentialsSettings } from './useCredentialsSettings';
import { usePackageSettings } from './usePackageSettings';
import { useSnapFlowActions } from './useSnapFlowActions';
import { useShareProtections } from './useShareProtections';
import { useWhatsAppTemplates } from './useWhatsAppTemplates';

export function useSnapFlowController() {
  const [shareToken] = useState(() => detectShareToken());
  const [notice, setNotice] = useState(null);
  
  useShareProtections(shareToken, setNotice);

  const getSavedState = (key, fallback) => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('snapflow-' + key);
        if (stored) {
          try { 
            const parsed = JSON.parse(stored); 
            if (parsed !== null) return parsed;
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
    return fallback;
  };

  const initialScreen = () => {
    const token = detectShareToken();
    const savedScreen = getSavedState('screen', 'dashboard');
    if (token) {
      const access = getSavedState('share-access', null);
      return resolveInitialScreen({ shareToken: token, savedScreen, savedShareAccess: access });
    }
    return resolveInitialScreen({ savedScreen });
  };

  const [screen, setScreen] = useState(initialScreen);
  const initialType = getSavedState('type', 'eventos');
  const [type, setType] = useState(() => DEFAULT_PRICING[initialType] ? initialType : 'eventos');
  
  const initialPhotos = getSavedState('photos', []);
  const [photos, setPhotos] = useState(() => Array.isArray(initialPhotos) ? initialPhotos : []);
  
  const initialSelected = getSavedState('selected', []);
  const [selected, setSelected] = useState(() => Array.isArray(initialSelected) ? initialSelected : []);
  
  const [clientPhone, setClientPhone] = useState(() => getSavedState('clientPhone', ''));
  const [clientName, setClientName] = useState(() => getSavedState('clientName', ''));
  const [clientEmail, setClientEmail] = useState(() => getSavedState('clientEmail', ''));
  const [sessionId, setSessionId] = useState(() => getSavedState('sessionId', ''));
  const [qrCodeBase64, setQrCodeBase64] = useState(() => getSavedState('qrCodeBase64', ''));
  const [pixCopyPaste, setPixCopyPaste] = useState(() => getSavedState('pixCopyPaste', ''));
  const [pixWhatsAppMessage, setPixWhatsAppMessage] = useState(() => getSavedState('pixWhatsAppMessage', ''));
  const [liveOps, setLiveOps] = useState(() => {
    const saved = getSavedState('liveOps', null);
    return saved && typeof saved === 'object' ? saved : {
      paymentStatus: 'draft',
      deliveryStatus: 'idle',
      deliveryError: null,
      paymentMethod: null,
    };
  });
  const [period, setPeriod] = useState('hoje');
  const [viewerIndex, setViewerIndex] = useState(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState([]);
  const [shareSessionInfo, setShareSessionInfo] = useState(null);
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [shareAccess, setShareAccess] = useState(() => getSavedState('share-access', null));
  const [shareActionLoading, setShareActionLoading] = useState(false);
  const [shareDurationMinutes, setShareDurationMinutes] = useState(30);
  const {
    adminAccessError,
    adminAccessStatus,
    adminAttemptsRemaining,
    adminHeaders,
    adminJsonHeaders,
    adminRemember,
    adminToken,
    isAdminUnlocked,
    loginAdmin,
    logoutAdmin,
    withAdminMediaToken,
  } = useAdminAccess();
  const [retentionSettings, setRetentionSettings] = useState({
    defaultGalleryRetentionDays: 30,
    deliveredPhotoRetentionDays: 30,
    expiredShareRetentionDays: 7,
    archiveBeforeDelete: false,
    autoCleanupEnabled: false,
  });
  const [cleanupPreview, setCleanupPreview] = useState(null);
  const [dashData, setDashData] = useState({
    stats: {
      hoje: { valor: 0, fotos: 0, sessoes: 0 },
      semana: { valor: 0, fotos: 0, sessoes: 0 },
      mes: { valor: 0, fotos: 0, sessoes: 0 },
      ano: { valor: 0, fotos: 0, sessoes: 0 },
    },
    chartSeries: {
      diario: [],
      semanal: [],
      mensal: [],
      anual: [],
    },
    recent: [],
    shareRecent: [],
  });
  const [, setPendingManualSessions] = useState([]);
  const [notifiedSessions, setNotifiedSessions] = useState(new Set());
  const { packageSettingsStatus, pricingOptions, savePackageSettings } = usePackageSettings({
    adminJsonHeaders,
    currentType: type,
    isAdminUnlocked,
    setNotice,
    setType,
  });
  const {
    credentialsData,
    credentialsStatus,
    deleteCredential,
    loadCredentials,
    saveCredential,
    saveCredentialsBatch,
  } = useCredentialsSettings({
    adminJsonHeaders,
    isAdminUnlocked,
    setNotice,
  });
  const {
    saveWhatsAppTemplates,
    whatsAppTemplateStatus,
    whatsAppTemplates,
  } = useWhatsAppTemplates({
    adminJsonHeaders,
    isAdminUnlocked,
    setNotice,
  });
  
  // Persist important state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const prefix = 'snapflow-';
        window.localStorage.setItem(prefix + 'screen', JSON.stringify(screen));
        window.localStorage.setItem(prefix + 'type', JSON.stringify(type));
        window.localStorage.setItem(prefix + 'selected', JSON.stringify(selected));
        window.localStorage.setItem(prefix + 'clientPhone', JSON.stringify(clientPhone));
        window.localStorage.setItem(prefix + 'clientName', JSON.stringify(clientName));
        window.localStorage.setItem(prefix + 'clientEmail', JSON.stringify(clientEmail));
        window.localStorage.setItem(prefix + 'sessionId', JSON.stringify(sessionId));
        window.localStorage.setItem(prefix + 'qrCodeBase64', JSON.stringify(qrCodeBase64));
        window.localStorage.setItem(prefix + 'pixCopyPaste', JSON.stringify(pixCopyPaste));
        window.localStorage.setItem(prefix + 'pixWhatsAppMessage', JSON.stringify(pixWhatsAppMessage));
        window.localStorage.setItem(prefix + 'liveOps', JSON.stringify(liveOps));
      } catch { /* ignore */ }
    }
  }, [screen, type, selected, clientPhone, clientName, clientEmail, sessionId, qrCodeBase64, pixCopyPaste, pixWhatsAppMessage, liveOps]);
  
  // Save photos only if shareToken exists
  useEffect(() => {
    if (typeof window !== 'undefined' && shareToken) {
      try {
        window.localStorage.setItem('snapflow-photos', JSON.stringify(photos));
      } catch { /* ignore */ }
    }
  }, [photos, shareToken]);

  const toggle = (id) =>
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );

  const toggleAllPhotos = () => {
    setSelected((previous) => (previous.length === photos.length ? [] : photos.map((photo) => photo.id)));
  };

  const count = selected.length;
  const activePackageType = pricingOptions[type] ? type : firstPackageKey(pricingOptions);
  const { unit, total } = calcTotal(count, activePackageType, pricingOptions);
  const pricing = pricingOptions[activePackageType];
  const remaining = Math.max(0, pricing.threshold - count);
  const hasDiscount = count >= pricing.threshold;
  const allPhotosSelected = photos.length > 0 && selected.length === photos.length;
  const selectedPhotoItems = useMemo(
    () =>
      selected
        .map((id) => photos.find((photo) => photo.id === id))
        .filter(Boolean),
    [photos, selected]
  );

  const activeStage = {
    dashboard: 'Pronto para iniciar uma nova venda',
    gallery: 'Selecionando fotos para o cliente',
    summary: 'Conferindo valor e WhatsApp',
    pix: 'Aguardando confirmação do pagamento',
    'manual-pending': 'Aguardando aprovação manual no painel',
    confirmed: 'Acompanhando entrega final',
  }[screen];

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!isAdminUnlocked) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage('Não foi possível carregar o painel.', response, data));
      }

      setDashData(data);
    } catch (error) {
      if (!silent) {
        console.error('Falha ao carregar dashboard:', error);
        setNotice(buildNetworkErrorMessage('Não foi possível carregar o painel.', error));
      }
    }
  }, [isAdminUnlocked, adminHeaders, setNotice]);

  const fetchRetentionSettings = useCallback(async () => {
    if (!isAdminUnlocked) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/retention`, {
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (response.ok) {
        setRetentionSettings(data);
      }
    } catch (error) {
      console.warn('Falha ao carregar retenção:', error);
    }
  }, [isAdminUnlocked, adminHeaders]);

  const saveRetentionSettings = async () => {
    if (!isAdminUnlocked) {
      setNotice('Valide o token administrativo antes de salvar a retenção.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/retention`, {
        method: 'PUT',
        headers: adminJsonHeaders(),
        body: JSON.stringify(retentionSettings),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível salvar a retenção.', response, data));
        return;
      }
      setRetentionSettings(data);
      setNotice('Política de retenção salva.');
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível salvar a retenção.', error));
    }
  };

  const previewCleanup = async () => {
    if (!isAdminUnlocked) {
      setNotice('Valide o token administrativo antes de prever a limpeza.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/cleanup/preview`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível calcular a limpeza.', response, data));
        return;
      }
      setCleanupPreview(data);
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível calcular a limpeza.', error));
    }
  };

  const runCleanup = async () => {
    if (!isAdminUnlocked) {
      setNotice('Valide o token administrativo antes de executar a limpeza.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/cleanup/run`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível executar a limpeza.', response, data));
        return;
      }
      setCleanupPreview(data);
      setNotice('Limpeza de retenção executada.');
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível executar a limpeza.', error));
    }
  };

  useDashboardPolling({
    adminHeaders,
    isAdminUnlocked,
    notifiedSessions,
    screen,
    setDashData,
    setNotice,
    setNotifiedSessions,
    setPendingManualSessions,
    shareToken,
  });

  useEffect(() => {
    if (screen === 'dashboard' && isAdminUnlocked) {
      fetchRetentionSettings().catch((error) => console.warn('Falha ao carregar retenção:', error));
      loadCredentials({ silent: true });
    }
  }, [screen, isAdminUnlocked, fetchRetentionSettings, loadCredentials]);

  useEffect(() => {
    if (!shareToken) return undefined;

    const loadSharedSession = async () => {
      try {
        const response = await fetch(API_BASE_URL + '/api/share-session/' + shareToken);
        const data = await readJsonResponse(response);
        if (!response.ok) {
          throw new Error(buildApiErrorMessage('Não foi possível carregar o link compartilhado.', response, data));
        }

        setShareSessionInfo(data);
        if (data.expired || data.status === 'revoked') {
          setNotice('Este link expirou ou foi revogado.');
        }
      } catch (error) {
        console.error('Falha ao carregar link compartilhado:', error);
        setShareSessionInfo({ error: buildNetworkErrorMessage('Link não encontrado ou expirado.', error) });
      }
    };

    loadSharedSession();

    return undefined;
  }, [shareToken]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;

    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (shareAccess) {
      window.localStorage.setItem('snapflow-share-access', JSON.stringify(shareAccess));
    } else {
      window.localStorage.removeItem('snapflow-share-access');
    }

    return undefined;
  }, [shareAccess]);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (viewerIndex === null) return undefined;
    if (photos[viewerIndex]) return undefined;

    setViewerIndex(photos.length ? 0 : null);
    return undefined;
  }, [photos, viewerIndex]);

  useEffect(() => {
    if (!['pix', 'manual-pending'].includes(screen) || !sessionId) return undefined;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(API_BASE_URL + '/api/status/' + sessionId);
        if (!response.ok) {
          throw new Error('Status retornou ' + response.status);
        }

        const data = await response.json();
        setLiveOps((previous) => ({
          ...previous,
          paymentStatus: data.status === 'approved' ? 'approved' : 'pending',
          deliveryStatus: data.deliveryStatus || previous.deliveryStatus,
          deliveryError: data.deliveryError || null,
          paymentMethod: data.paymentMethod || previous.paymentMethod,
        }));

        if (data.status === 'approved') {
          if (liveOps.paymentStatus !== 'approved') {
            setNotice(data.paymentMethod === 'PIX'
              ? 'Pix confirmado pelo Mercado Pago. Fotos liberadas para entrega.'
              : 'Pagamento confirmado e fotos liberadas.');
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('SnapFlow', {
                body: 'Pagamento confirmado e fotos liberadas.',
              });
            }
          }
          setScreen('confirmed');
          fetchDashboard({ silent: true });
        }
      } catch (error) {
        console.warn('Falha ao consultar status do pagamento:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [screen, sessionId, liveOps.paymentStatus, fetchDashboard]);

  const {
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
  } = useSnapFlowActions({
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
    setClientEmail,
    setClientPhone,
    setIsGeneratingPix,
    setIsUploading,
    setLiveOps,
    setNotice,
    setPhotos,
    setPixCopyPaste,
    setPixWhatsAppMessage,
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
    type: activePackageType,
    withAdminMediaToken,
  });

  const currentPhoto = viewerIndex !== null ? photos[viewerIndex] : null;
  const hasActiveSession = photos.length > 0 || Boolean(sessionId);
  const noticeBanner = notice ? <NoticeBanner notice={notice} onClose={() => setNotice(null)} /> : null;

  return {
    activeStage,
    adminAccessError,
    adminAccessStatus,
    adminAttemptsRemaining,
    adminHeaders,
    adminJsonHeaders,
    adminRemember,
    adminToken,
    allPhotosSelected,
    brokenPhotoIds,
    cleanupPreview,
    clientName,
    clientEmail,
    clientPhone,
    count,
    currentPhoto,
    credentialsData,
    credentialsStatus,
    dashData,
    deleteCredential,
    fetchDashboard,
    handleCreateShareSession,
    handleExtendShareSession,
    handleFileUpload,
    handleGeneratePix,
    handleManualPayment,
    handleRevokeShareSession,
    handleUnlockSharedSession,
    hasActiveSession,
    hasDiscount,
    isGeneratingPix,
    isAdminUnlocked,
    isUploading,
    liveOps,
    loginAdmin,
    logoutAdmin,
    markBrokenPhoto,
    noticeBanner,
    packageSettingsStatus,
    period,
    photos,
    pricingOptions,
    pixCopyPaste,
    pixWhatsAppMessage,
    previewCleanup,
    qrCodeBase64,
    remaining,
    resetSession,
    retentionSettings,
    runCleanup,
    saveCredential,
    saveCredentialsBatch,
    saveRetentionSettings,
    savePackageSettings,
    saveWhatsAppTemplates,
    screen,
    selected,
    selectedPhotoItems,
    sessionId,
    setClientEmail,
    setClientPhone,
    setClientName,
    setNotice,
    setPeriod,
    setPixCopyPaste,
    setQrCodeBase64,
    setRetentionSettings,
    setScreen,
    setShareCodeInput,
    setShareDurationMinutes,
    setType,
    setViewerIndex,
    shareAccess,
    shareActionLoading,
    shareCodeInput,
    shareDurationMinutes,
    shareSessionInfo,
    shareToken,
    startNewSession,
    toggle,
    toggleAllPhotos,
    total,
    type: activePackageType,
    unit,
    whatsAppTemplateStatus,
    whatsAppTemplates,
    withAdminMediaToken,
  };
}
