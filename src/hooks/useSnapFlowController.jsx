import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';
import { applyManualDiscount, validateDiscountDraft } from '../lib/discounts';
import { EMPTY_PHOTOS_PAGE, derivePhotoPageCounts, normalizePhotosPage } from '../lib/photoPages';
import { DEFAULT_PRICING, calcTotal, firstPackageKey, pricingForType } from '../lib/pricing';
import { detectShareToken } from '../lib/share';
import { ADMIN_STAGE_LABELS, CLIENT_STAGE_LABELS } from '../lib/stageLabels';
import { NotificationCenterButton } from '../components/NotificationCenterButton';
import { NoticeBanner } from '../components/NoticeBanner';
import { useAdminAccess } from './useAdminAccess';
import { useDashboardPolling } from './useDashboardPolling';
import { useCredentialsSettings } from './useCredentialsSettings';
import { useNoticeCenter } from './useNoticeCenter';
import { usePackageSettings } from './usePackageSettings';
import { usePersistSnapFlowState, getSavedSnapFlowState, resolveInitialSnapFlowScreen } from './useSnapFlowPersistence';
import { useRetentionControls } from './useRetentionControls';
import { useSnapFlowActions } from './useSnapFlowActions';
import { useShareProtections } from './useShareProtections';
import { useWhatsAppTemplates } from './useWhatsAppTemplates';
import { useWatermarkSettings } from './useWatermarkSettings';

export function useSnapFlowController() {
  const [shareToken] = useState(() => detectShareToken());
  const {
    activeNotice,
    clearNotificationHistory,
    dismissNotice,
    hasSeenNotification,
    noticeHistory,
    notificationCenterOpen,
    rememberNotifications,
    setNotice,
    toggleNotificationCenter,
    unreadNoticeCount,
  } = useNoticeCenter();
  
  useShareProtections(shareToken, setNotice);

  const [screen, setScreen] = useState(resolveInitialSnapFlowScreen);
  const initialType = getSavedSnapFlowState('type', 'eventos');
  const [type, setType] = useState(() => DEFAULT_PRICING[initialType] ? initialType : 'eventos');
  
  const initialPhotos = shareToken ? [] : getSavedSnapFlowState('photos', []);
  const [photos, setPhotos] = useState(() => Array.isArray(initialPhotos) ? initialPhotos : []);
  const [photosPage, setPhotosPage] = useState(() => normalizePhotosPage(EMPTY_PHOTOS_PAGE));
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [photoPageError, setPhotoPageError] = useState('');
  const [hasLoadedPhotosPage, setHasLoadedPhotosPage] = useState(false);
  
  const initialSelected = getSavedSnapFlowState('selected', []);
  const [selected, setSelected] = useState(() => Array.isArray(initialSelected) ? initialSelected : []);
  
  const [clientPhone, setClientPhone] = useState(() => getSavedSnapFlowState('clientPhone', ''));
  const [clientName, setClientName] = useState(() => getSavedSnapFlowState('clientName', ''));
  const [clientEmail, setClientEmail] = useState(() => getSavedSnapFlowState('clientEmail', ''));
  const [manualDiscountEnabled, setManualDiscountEnabled] = useState(() => getSavedSnapFlowState('manualDiscountEnabled', false));
  const [manualDiscountDraft, setManualDiscountDraft] = useState(() => getSavedSnapFlowState('manualDiscountDraft', ''));
  const [sessionId, setSessionId] = useState(() => getSavedSnapFlowState('sessionId', ''));
  const [qrCodeBase64, setQrCodeBase64] = useState(() => getSavedSnapFlowState('qrCodeBase64', ''));
  const [pixCopyPaste, setPixCopyPaste] = useState(() => getSavedSnapFlowState('pixCopyPaste', ''));
  const [pixWhatsAppMessage, setPixWhatsAppMessage] = useState(() => getSavedSnapFlowState('pixWhatsAppMessage', ''));
  const [liveOps, setLiveOps] = useState(() => {
    const saved = getSavedSnapFlowState('liveOps', null);
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
  const [shareAccess, setShareAccess] = useState(() => getSavedSnapFlowState('share-access', null));
  const [shareActionLoading, setShareActionLoading] = useState(false);
  const [shareDurationMinutes, setShareDurationMinutes] = useState(30);
  const {
    adminAccessError,
    adminAccessStatus,
    adminAttemptsRemaining,
    adminHeaders,
    adminJsonHeaders,
    adminLockedUntil,
    adminRemember,
    adminRetryAfterSeconds,
    adminToken,
    isAdminUnlocked,
    loginAdmin,
    logoutAdmin,
    withAdminMediaToken,
  } = useAdminAccess();
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
  const {
    cleanupPreview,
    fetchRetentionSettings,
    previewCleanup,
    retentionSettings,
    runCleanup,
    saveRetentionSettings,
    setRetentionSettings,
  } = useRetentionControls({
    adminHeaders,
    adminJsonHeaders,
    isAdminUnlocked,
    setNotice,
  });
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
  const {
    saveWatermarkSettings,
    watermarkSettings,
    watermarkSettingsStatus,
  } = useWatermarkSettings({
    adminJsonHeaders,
    isAdminUnlocked,
    setNotice,
  });
  
  usePersistSnapFlowState({
    clientEmail,
    clientName,
    clientPhone,
    liveOps,
    manualDiscountDraft,
    manualDiscountEnabled,
    pixCopyPaste,
    pixWhatsAppMessage,
    qrCodeBase64,
    screen,
    selected,
    sessionId,
    type,
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined' && shareToken) {
      try { window.localStorage.removeItem('snapflow-photos'); } catch { /* ignore */ }
    }
  }, [shareToken, setNotice]);

  const toggle = (id) =>
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );

  const toggleAllPhotos = () => {
    setSelected((previous) => (previous.length === photos.length ? [] : photos.map((photo) => photo.id)));
  };

  const count = selected.length;
  const activePackageType = pricingOptions[type] ? type : firstPackageKey(pricingOptions);
  const { unit, total: subtotal } = calcTotal(count, activePackageType, pricingOptions);
  const activePricing = pricingForType(activePackageType, pricingOptions);
  const discountValidation = validateDiscountDraft({
    enabled: !shareToken && manualDiscountEnabled,
    subtotal,
    value: manualDiscountDraft,
  });
  const configuredDiscountAmount = shareToken
    ? Number(shareSessionInfo.discountAmount || 0)
    : discountValidation.amount;
  const { discountAmount, total } = applyManualDiscount(subtotal, configuredDiscountAmount);
  const remaining = Math.max(0, activePricing.threshold - count);
  const hasDiscount = count >= activePricing.threshold;
  const allPhotosSelected = photos.length > 0 && selected.length === photos.length;
  const selectedPhotoItems = useMemo(
    () =>
      selected
        .map((id) => photos.find((photo) => photo.id === id))
        .filter(Boolean),
    [photos, selected]
  );
  const photoPageCounts = useMemo(
    () => derivePhotoPageCounts({ photos, selected, photosPage }),
    [photos, selected, photosPage]
  );

  const activeStage = (shareToken ? CLIENT_STAGE_LABELS : ADMIN_STAGE_LABELS)[screen];

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

  useDashboardPolling({
    adminHeaders,
    hasSeenNotification,
    isAdminUnlocked,
    rememberNotifications,
    screen,
    setDashData,
    setNotice,
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
  }, [shareToken, setNotice]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;

    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (!shareToken || !shareAccess.customerAccessToken || screen !== 'gallery') return undefined;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/share-session/${shareToken}/cart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${shareAccess.customerAccessToken}`,
          },
          body: JSON.stringify({ photoIds: selected }),
        });
        if (!response.ok) {
          const data = await readJsonResponse(response);
          throw new Error(buildApiErrorMessage('Não foi possível salvar sua seleção.', response, data));
        }
      } catch (error) {
        console.warn('Falha ao salvar carrinho compartilhado:', error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [screen, selected, shareAccess.customerAccessToken, shareToken]);

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
  }, [screen, sessionId, liveOps.paymentStatus, fetchDashboard, setNotice]);

  const {
    handleCreateShareSession,
    handleExtendShareSession,
    handleFileUpload,
    handleGeneratePix,
    handleManualPayment,
    handleRevokeShareSession,
    handleUnlockSharedSession,
    loadMorePhotos,
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
    discountAmount: shareToken ? configuredDiscountAmount : manualDiscountEnabled ? manualDiscountDraft : '',
    fetchDashboard,
    photos,
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
    setPhotoPageError,
    setHasLoadedPhotosPage,
    setPhotos,
    setPhotosPage,
    setPixCopyPaste,
    setPixWhatsAppMessage,
    setQrCodeBase64,
    setScreen,
    setSelected,
    setSessionId,
    setShareAccess,
    setShareActionLoading,
    setShareSessionInfo,
    setIsLoadingPhotos,
    setType,
    setViewerIndex,
    shareAccess,
    shareCodeInput,
    shareDurationMinutes,
    shareSessionInfo,
    shareToken,
    photosPage,
    isLoadingPhotos,
    pricingOptions,
    subtotal,
    total,
    type: activePackageType,
    withAdminMediaToken,
  });

  useEffect(() => {
    if (!shareToken || !shareAccess.customerAccessToken || screen !== 'gallery') return;
    if (photos.length > 0 || hasLoadedPhotosPage || isLoadingPhotos || photoPageError) return;
    loadMorePhotos();
  }, [hasLoadedPhotosPage, isLoadingPhotos, loadMorePhotos, photoPageError, photos.length, screen, shareAccess.customerAccessToken, shareToken]);

  const currentPhoto = viewerIndex !== null ? photos[viewerIndex] : null;
  const hasActiveSession = photos.length > 0 || Boolean(sessionId);
  const noticeBanner = activeNotice ? <NoticeBanner notice={activeNotice} onClose={dismissNotice} /> : null;
  const notificationCenter = isAdminUnlocked && !shareToken ? (
    <NotificationCenterButton
      items={noticeHistory}
      onClear={clearNotificationHistory}
      onToggle={toggleNotificationCenter}
      open={notificationCenterOpen}
      unreadCount={unreadNoticeCount}
    />
  ) : null;

  return {
    activeStage,
    adminAccessError,
    adminAccessStatus,
    adminAttemptsRemaining,
    adminHeaders,
    adminJsonHeaders,
    adminLockedUntil,
    adminRemember,
    adminRetryAfterSeconds,
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
    discountAmount,
    discountValidation,
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
    isLoadingPhotos,
    isUploading,
    liveOps,
    loadMorePhotos,
    manualDiscountDraft,
    manualDiscountEnabled,
    loginAdmin,
    logoutAdmin,
    markBrokenPhoto,
    noticeBanner,
    notificationCenter,
    packageSettingsStatus,
    period,
    photoPageCounts,
    photoPageError,
    photos,
    photosPage,
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
    saveWatermarkSettings,
    screen,
    selected,
    selectedPhotoItems,
    sessionId,
    setClientEmail,
    setClientPhone,
    setClientName,
    setManualDiscountDraft,
    setManualDiscountEnabled,
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
    subtotal,
    startNewSession,
    toggle,
    toggleAllPhotos,
    total,
    type: activePackageType,
    unit,
    whatsAppTemplateStatus,
    whatsAppTemplates,
    watermarkSettings,
    watermarkSettingsStatus,
    withAdminMediaToken,
  };
}
