import { useEffect } from 'react';
import { API_BASE_URL } from '../lib/apiClient';
import { EMPTY_PHOTOS_PAGE, normalizePhotosPage } from '../lib/photoPages';

export function usePaymentStatusPolling({
  fetchDashboard,
  liveOps,
  screen,
  sessionId,
  setHasLoadedPhotosPage,
  setLiveOps,
  setNotice,
  setPhotoPageError,
  setPhotos,
  setPhotosPage,
  setScreen,
  setSelected,
  shareToken,
}) {
  useEffect(() => {
    if (!['pix', 'manual-pending'].includes(screen) || !sessionId) return undefined;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(API_BASE_URL + '/api/status/' + sessionId);
        if (!response.ok) throw new Error('Status retornou ' + response.status);

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
              new Notification('SnapFlow', { body: 'Pagamento confirmado e fotos liberadas.' });
            }
          }
          if (shareToken) {
            setSelected([]);
            setPhotos([]);
            setPhotosPage(normalizePhotosPage(EMPTY_PHOTOS_PAGE));
            setHasLoadedPhotosPage(false);
            setPhotoPageError('');
            setScreen('gallery');
          } else {
            setScreen('confirmed');
          }
          fetchDashboard({ silent: true });
        }
      } catch (error) {
        console.warn('Falha ao consultar status do pagamento:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [
    fetchDashboard,
    liveOps.paymentStatus,
    screen,
    sessionId,
    setHasLoadedPhotosPage,
    setLiveOps,
    setNotice,
    setPhotoPageError,
    setPhotos,
    setPhotosPage,
    setScreen,
    setSelected,
    shareToken,
  ]);
}
