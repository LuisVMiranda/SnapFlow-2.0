import { buildApiErrorMessage } from './apiClient';
import { formatMoney } from './formatters';
import { normalizeWatermarkSettings } from '../hooks/useWatermarkSettings';

export function statusMeta(status) {
  if (status === 'revoked') return { label: 'Revogado', tone: 'danger' };
  if (status === 'expired') return { label: 'Expirado', tone: 'neutral' };
  if (status === 'opened') return { label: 'Aberto', tone: 'success' };
  return { label: 'Ativo', tone: 'info' };
}

export function shareLink(shareSession) {
  return shareSession.link || `${window.location.origin}/s/${shareSession.token}`;
}

export function draftFromShare(shareSession) {
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
    photoPresetIds: shareSession.photoPresetIds || [],
    subtotal: String(shareSession.subtotal ?? shareSession.total ?? ''),
    watermarkAssetId: shareSession.watermarkAssetId || '',
    watermarkSettings: normalizeWatermarkSettings(shareSession.watermarkSettings || {}),
  };
}

export function gallerySalesLabel(shareSession) {
  const sales = shareSession.sales || {};
  const soldPhotoCount = Number(sales.soldPhotoCount || 0);
  const soldOrderCount = Number(sales.soldOrderCount || 0);
  const soldAmount = Number(sales.soldAmount || 0);
  return `${soldPhotoCount} foto(s) vendidas até agora em ${soldOrderCount} pedido(s) - ${formatMoney(soldAmount)}`;
}

export function galleryRouteErrorMessage(prefix, response, data) {
  const message = buildApiErrorMessage(prefix, response, data);
  return data.code === 'api_route_not_found'
    ? `${message} Backend desatualizado. Reinicie o servidor para carregar as rotas de galeria.`
    : message;
}
