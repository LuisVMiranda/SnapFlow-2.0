import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

const controllerMock = vi.hoisted(() => ({ value: null }));

vi.mock('./hooks/useSnapFlowController', () => ({
  useSnapFlowController: () => controllerMock.value,
}));

vi.mock('./hooks/usePhotoPresets', () => ({
  usePhotoPresets: () => ({
    createPhotoPreset: () => {},
    deletePhotoPreset: () => {},
    photoPresets: [],
    photoPresetStatus: 'idle',
    updatePhotoPreset: () => {},
  }),
}));

const noop = () => {};

function makeController(overrides = {}) {
  const photos = [{ id: 'photo_1', url: '/preview/photo_1.jpg', thumbUrl: '/thumb/photo_1.jpg' }];

  return {
    activeStage: 'Selecionando fotos',
    adminAccessError: '',
    adminAccessStatus: 'idle',
    adminAttemptsRemaining: 5,
    adminHeaders: () => ({}),
    adminJsonHeaders: () => ({ 'Content-Type': 'application/json' }),
    adminLockedUntil: '',
    adminRemember: false,
    adminRetryAfterSeconds: 0,
    allPhotosSelected: false,
    brokenPhotoIds: [],
    cleanupPreview: null,
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    count: 0,
    currentPhoto: null,
    credentialsData: {},
    credentialsStatus: 'idle',
    dashData: { stats: {}, chartSeries: {}, recent: [], shareRecent: [] },
    deleteCredential: noop,
    discountAmount: 0,
    discountValidation: { valid: true, message: '' },
    fetchDashboard: noop,
    handleCreateShareSession: noop,
    handleExtendShareSession: noop,
    handleFileUpload: noop,
    handleGeneratePix: noop,
    handleManualPayment: noop,
    handleRevokeShareSession: noop,
    handleUnlockSharedSession: noop,
    hasActiveSession: true,
    hasDiscount: false,
    isGeneratingPix: false,
    isAdminUnlocked: false,
    isLoadingPhotos: false,
    isUploading: false,
    liveOps: { paymentStatus: 'draft', deliveryStatus: 'idle', deliveryError: null, paymentMethod: null },
    loadMorePhotos: noop,
    loginAdmin: noop,
    logoutAdmin: noop,
    manualDiscountDraft: '',
    manualDiscountEnabled: false,
    markBrokenPhoto: noop,
    noticeBanner: null,
    notificationCenter: null,
    packageSettingsStatus: 'idle',
    period: 'hoje',
    photoPageCounts: { loadedCount: 1, selectedCount: 0, selectedLoadedCount: 0, totalCount: 1 },
    photoPageError: '',
    photos,
    photosPage: { hasMore: false, nextCursor: null, loadedCount: 1, totalCount: 1 },
    pricingOptions: { eventos: { label: 'Eventos', shortLabel: 'Eventos', unit: 10, bulk: 8, threshold: 3 } },
    pixCopyPaste: '',
    pixWhatsAppMessage: '',
    previewCleanup: noop,
    qrCodeBase64: '',
    remaining: 3,
    resetSession: noop,
    retentionSettings: {},
    runCleanup: noop,
    saveCredential: noop,
    saveCredentialsBatch: noop,
    savePackageSettings: noop,
    saveRetentionSettings: noop,
    saveWatermarkSettings: noop,
    saveWhatsAppTemplates: noop,
    screen: 'gallery',
    selected: [],
    selectedPhotoItems: [],
    sessionId: '',
    setClientEmail: noop,
    setClientName: noop,
    setClientPhone: noop,
    setManualDiscountDraft: noop,
    setManualDiscountEnabled: noop,
    setNotice: noop,
    setPeriod: noop,
    setPixCopyPaste: noop,
    setQrCodeBase64: noop,
    setRetentionSettings: noop,
    setScreen: noop,
    setShareCodeInput: noop,
    setShareDurationMinutes: noop,
    setType: noop,
    setViewerIndex: noop,
    shareAccess: null,
    shareActionLoading: false,
    shareCodeInput: '',
    shareDurationMinutes: 30,
    shareSessionInfo: null,
    shareToken: 'share_1',
    subtotal: 0,
    startNewSession: noop,
    toggle: noop,
    toggleAllPhotos: noop,
    total: 0,
    type: 'eventos',
    unit: 10,
    whatsAppTemplateStatus: 'idle',
    whatsAppTemplates: {},
    watermarkSettings: { width: 420, height: 120, opacity: 0.22, instances: 3 },
    watermarkSettingsStatus: 'idle',
    withAdminMediaToken: (url) => url,
    ...overrides,
  };
}

describe('App shared-gallery null states', () => {
  it('renders the shared code gate before metadata finishes loading', () => {
    controllerMock.value = makeController({ screen: 'share-lock', shareSessionInfo: null });

    render(<App />);

    expect(screen.getByText('SnapFlow compartilhado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir galeria' })).toBeEnabled();
  });

  it('renders a shared gallery while watermark metadata is still loading', () => {
    controllerMock.value = makeController({ screen: 'gallery', shareSessionInfo: null });

    render(<App />);

    expect(screen.getByText('Modo de Visualização')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar pedido' })).toBeDisabled();
  });

  it('renders the shared photo viewer while watermark metadata is still loading', () => {
    const photos = [{ id: 'photo_1', url: '/preview/photo_1.jpg', thumbUrl: '/thumb/photo_1.jpg' }];
    controllerMock.value = makeController({
      currentPhoto: photos[0],
      photos,
      screen: 'gallery',
      shareSessionInfo: null,
      selected: ['photo_1'],
    });

    render(<App />);

    expect(screen.getByAltText('Foto selecionada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover da sacola' })).toBeInTheDocument();
  });
});
