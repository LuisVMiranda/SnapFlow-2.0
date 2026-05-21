import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSnapFlowActions } from './useSnapFlowActions';

const noop = () => {};

function makeActionsConfig(overrides = {}) {
  return {
    adminHeaders: () => ({}),
    adminJsonHeaders: () => ({ 'Content-Type': 'application/json' }),
    clientName: 'Cliente',
    clientEmail: '',
    clientPhone: '+55 11999999999',
    count: 1,
    discountAmount: 0,
    fetchDashboard: noop,
    photos: [{ id: 'photo_1', url: '/photo.jpg', thumbUrl: '/thumb.jpg' }],
    selectedPhotoItems: [{ id: 'photo_1', url: '/photo.jpg', thumbUrl: '/thumb.jpg' }],
    sessionId: '',
    setBrokenPhotoIds: noop,
    setClientName: noop,
    setClientEmail: noop,
    setClientPhone: noop,
    setIsGeneratingPix: noop,
    setHasLoadedPhotosPage: noop,
    setIsUploading: noop,
    setLiveOps: noop,
    setNotice: noop,
    setPhotoPageError: noop,
    setPhotos: noop,
    setPhotosPage: noop,
    setPixCopyPaste: noop,
    setPixWhatsAppMessage: noop,
    setQrCodeBase64: noop,
    setScreen: noop,
    setSelected: noop,
    setSessionId: noop,
    setShareAccess: noop,
    setShareActionLoading: noop,
    setShareSessionInfo: noop,
    setIsLoadingPhotos: noop,
    setType: noop,
    setViewerIndex: noop,
    shareAccess: null,
    shareCodeInput: '',
    shareDurationMinutes: 30,
    shareSessionInfo: null,
    shareToken: 'share_1',
    photosPage: { hasMore: false, nextCursor: null, totalCount: 1 },
    isLoadingPhotos: false,
    pricingOptions: {
      eventos: { label: 'Eventos', shortLabel: 'Eventos', unit: 10, bulk: 8, threshold: 3 },
    },
    subtotal: 10,
    total: 10,
    type: 'eventos',
    withAdminMediaToken: (url) => url,
    ...overrides,
  };
}

describe('useSnapFlowActions shared null states', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not crash when shared manual payment starts before access metadata exists', async () => {
    const alertMock = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Token do cliente ausente.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('alert', alertMock);
    vi.stubGlobal('fetch', fetchMock);

    const actions = useSnapFlowActions(makeActionsConfig());
    await actions.handleManualPayment('manual');

    const [, request] = fetchMock.mock.calls[0];
    expect(request.headers.Authorization).toBe('Bearer ');
    expect(JSON.parse(request.body).accessCode).toBe('');
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Não foi possível registrar o pagamento manual.'));
  });

  it('does not request more shared photos without a customer access token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const actions = useSnapFlowActions(makeActionsConfig({
      photos: [],
      photosPage: { hasMore: true, nextCursor: null, totalCount: 3 },
    }));
    await actions.loadMorePhotos();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the package from the shared gallery instead of falling back before packages load', async () => {
    const setType = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        customerAccessToken: 'customer-token',
        packageType: 'marco_dos_corais',
        photos: [{ id: 'photo_1', url: '/photo.jpg', thumbUrl: '/thumb.jpg' }],
        photosPage: { hasMore: false, loadedCount: 1, totalCount: 1 },
        photoCount: 1,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const actions = useSnapFlowActions(makeActionsConfig({
      setType,
      shareCodeInput: 'ABCD',
      pricingOptions: {
        eventos: { label: 'Eventos', shortLabel: 'Eventos', unit: 10, bulk: 8, threshold: 3 },
      },
    }));
    await actions.handleUnlockSharedSession();

    expect(setType).toHaveBeenCalledWith('marco_dos_corais');
  });
});
