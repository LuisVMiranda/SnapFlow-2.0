import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';
import {
  DEFAULT_DELIVERY_MODE,
  DEFAULT_POST_PAYMENT_ACCESS_DAYS,
  deliveryModeForOriginals,
  normalizePostPaymentAccessDays,
  sendsOriginalsViaWhatsapp,
} from '../lib/deliveryMode';

export const DEFAULT_DELIVERY_MODE_SETTINGS = {
  defaultDeliveryMode: DEFAULT_DELIVERY_MODE,
  defaultPostPaymentAccessDays: DEFAULT_POST_PAYMENT_ACCESS_DAYS,
  defaultSendOriginalsViaWhatsapp: false,
};

export function normalizeDeliveryModeSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const defaultSendOriginalsViaWhatsapp = source.defaultSendOriginalsViaWhatsapp === undefined
    ? sendsOriginalsViaWhatsapp(source.defaultDeliveryMode || DEFAULT_DELIVERY_MODE)
    : source.defaultSendOriginalsViaWhatsapp === true;
  return {
    defaultDeliveryMode: deliveryModeForOriginals(defaultSendOriginalsViaWhatsapp),
    defaultPostPaymentAccessDays: normalizePostPaymentAccessDays(source.defaultPostPaymentAccessDays),
    defaultSendOriginalsViaWhatsapp,
  };
}

export function useDeliveryModeSettings({ adminJsonHeaders, isAdminUnlocked, setNotice }) {
  const [deliveryModeSettings, setDeliveryModeSettings] = useState(DEFAULT_DELIVERY_MODE_SETTINGS);
  const [deliveryModeStatus, setDeliveryModeStatus] = useState('idle');

  const loadDeliveryModeSettings = useCallback(async ({ silent = false } = {}) => {
    if (!isAdminUnlocked) return DEFAULT_DELIVERY_MODE_SETTINGS;
    setDeliveryModeStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/gallery-delivery`, {
        headers: adminJsonHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage('Não foi possível carregar o modo de entrega.', response, data));
      }
      const normalized = normalizeDeliveryModeSettings(data);
      setDeliveryModeSettings(normalized);
      setDeliveryModeStatus('idle');
      return normalized;
    } catch (error) {
      setDeliveryModeStatus('error');
      if (!silent) setNotice(buildNetworkErrorMessage('Não foi possível carregar o modo de entrega.', error));
      return DEFAULT_DELIVERY_MODE_SETTINGS;
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  useEffect(() => {
    loadDeliveryModeSettings({ silent: true });
  }, [loadDeliveryModeSettings]);

  const saveDeliveryModeSettings = useCallback(async (settings) => {
    if (!isAdminUnlocked) {
      setNotice('Valide a conta administrativa antes de salvar o modo de entrega.');
      return false;
    }
    setDeliveryModeStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/gallery-delivery`, {
        method: 'PUT',
        headers: adminJsonHeaders(),
        body: JSON.stringify(normalizeDeliveryModeSettings(settings)),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível salvar o modo de entrega.', response, data));
        setDeliveryModeStatus('error');
        return false;
      }
      const normalized = normalizeDeliveryModeSettings(data);
      setDeliveryModeSettings(normalized);
      setDeliveryModeStatus('saved');
      setNotice('Modo de entrega salvo.');
      return true;
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível salvar o modo de entrega.', error));
      setDeliveryModeStatus('error');
      return false;
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  return {
    deliveryModeSettings,
    deliveryModeStatus,
    loadDeliveryModeSettings,
    saveDeliveryModeSettings,
  };
}
