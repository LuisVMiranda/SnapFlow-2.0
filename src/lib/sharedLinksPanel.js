import { buildApiErrorMessage } from './apiClient';
import { formatMoney } from './formatters';
import {
  normalizeDeliveryMode,
  normalizePostPaymentAccessDays,
  sendsOriginalsViaWhatsapp,
} from './deliveryMode';
import { normalizeOverlaySettings } from '../hooks/useOverlaySettings';
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

export function dateTimeLocalValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function valueOrEmpty(value) {
  return value === null || value === undefined ? '' : value;
}

function positiveMoneyText(value) {
  return Number(value) > 0 ? String(value) : '';
}

function firstDefined(...values) {
  return values.find((value) => value !== null && value !== undefined);
}

export function draftFromShare(shareSession) {
  const deliveryMode = normalizeDeliveryMode(shareSession.deliveryMode, 'whatsapp');
  return {
    accessCode: valueOrEmpty(shareSession.accessCode),
    clientName: valueOrEmpty(shareSession.clientName),
    clientEmail: valueOrEmpty(shareSession.clientEmail),
    discountAmount: positiveMoneyText(shareSession.discountAmount),
    deliveryMode,
    expiresAt: dateTimeLocalValue(shareSession.expiresAt),
    expiresMinutes: '',
    galleryDescription: valueOrEmpty(shareSession.galleryDescription),
    galleryName: valueOrEmpty(shareSession.galleryName),
    packageType: valueOrEmpty(shareSession.packageType),
    phone: valueOrEmpty(shareSession.phone),
    photoPresetIds: Array.isArray(shareSession.photoPresetIds) ? shareSession.photoPresetIds : [],
    overlayAssetId: valueOrEmpty(shareSession.overlayAssetId),
    overlayEnabled: Boolean(shareSession.overlayEnabled),
    overlaySettings: normalizeOverlaySettings(valueOrEmpty(shareSession.overlaySettings)),
    postPaymentAccessDays: normalizePostPaymentAccessDays(shareSession.postPaymentAccessDays),
    sendOriginalsViaWhatsapp: sendsOriginalsViaWhatsapp(deliveryMode),
    storyDeliveryEnabled: Boolean(shareSession.storyDeliveryEnabled),
    subtotal: String(firstDefined(shareSession.subtotal, shareSession.total, '')),
    watermarkAssetId: valueOrEmpty(shareSession.watermarkAssetId),
    watermarkSettings: normalizeWatermarkSettings(valueOrEmpty(shareSession.watermarkSettings)),
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
