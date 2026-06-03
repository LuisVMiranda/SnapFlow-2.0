import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';

export const DEFAULT_STORY_DELIVERY_SETTINGS = {
  defaultEnabled: false,
};

export function normalizeStoryDeliverySettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    defaultEnabled: source.defaultEnabled === true,
  };
}

export function useStoryDeliverySettings({ adminJsonHeaders, isAdminUnlocked, setNotice }) {
  const [storyDeliverySettings, setStoryDeliverySettings] = useState(DEFAULT_STORY_DELIVERY_SETTINGS);
  const [storyDeliveryStatus, setStoryDeliveryStatus] = useState('idle');

  const loadStoryDeliverySettings = useCallback(async ({ silent = false } = {}) => {
    if (!isAdminUnlocked) return DEFAULT_STORY_DELIVERY_SETTINGS;
    setStoryDeliveryStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/story-delivery`, {
        headers: adminJsonHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage('Não foi possível carregar a entrega para Stories.', response, data));
      }
      const normalized = normalizeStoryDeliverySettings(data);
      setStoryDeliverySettings(normalized);
      setStoryDeliveryStatus('idle');
      return normalized;
    } catch (error) {
      setStoryDeliveryStatus('error');
      if (!silent) setNotice(buildNetworkErrorMessage('Não foi possível carregar a entrega para Stories.', error));
      return DEFAULT_STORY_DELIVERY_SETTINGS;
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  useEffect(() => {
    loadStoryDeliverySettings({ silent: true });
  }, [loadStoryDeliverySettings]);

  const saveStoryDeliverySettings = useCallback(async (settings) => {
    if (!isAdminUnlocked) {
      setNotice('Valide a conta administrativa antes de salvar a entrega para Stories.');
      return false;
    }
    setStoryDeliveryStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/story-delivery`, {
        method: 'PUT',
        headers: adminJsonHeaders(),
        body: JSON.stringify(normalizeStoryDeliverySettings(settings)),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível salvar a entrega para Stories.', response, data));
        setStoryDeliveryStatus('error');
        return false;
      }
      const normalized = normalizeStoryDeliverySettings(data);
      setStoryDeliverySettings(normalized);
      setStoryDeliveryStatus('saved');
      setNotice('Entrega para Stories salva.');
      return true;
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível salvar a entrega para Stories.', error));
      setStoryDeliveryStatus('error');
      return false;
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  return {
    loadStoryDeliverySettings,
    saveStoryDeliverySettings,
    storyDeliverySettings,
    storyDeliveryStatus,
  };
}
