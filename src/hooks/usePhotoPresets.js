import { useCallback, useEffect, useState } from 'react';
import {
  API_BASE_URL,
  buildApiErrorMessage,
  buildNetworkErrorMessage,
  readJsonResponse,
} from '../lib/apiClient';

export function usePhotoPresets({ adminJsonHeaders, isAdminUnlocked, setNotice }) {
  const [photoPresetStatus, setPhotoPresetStatus] = useState('idle');
  const [photoPresets, setPhotoPresets] = useState([]);

  const loadPhotoPresets = useCallback(async ({ silent = false } = {}) => {
    if (!isAdminUnlocked) return [];
    setPhotoPresetStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/photo-presets`, {
        headers: adminJsonHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage('Não foi possível carregar presets de edição.', response, data));
      }
      setPhotoPresets(Array.isArray(data) ? data : []);
      setPhotoPresetStatus('ready');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      setPhotoPresetStatus('error');
      if (!silent) setNotice(buildNetworkErrorMessage('Não foi possível carregar presets de edição.', error));
      return [];
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  useEffect(() => {
    loadPhotoPresets({ silent: true });
  }, [loadPhotoPresets]);

  const requestPresetChange = useCallback(async (url, options, successMessage) => {
    setPhotoPresetStatus('saving');
    try {
      const response = await fetch(url, options);
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage('Não foi possível salvar presets de edição.', response, data));
      }
      const nextPresets = Array.isArray(data) ? data : [];
      setPhotoPresets(nextPresets);
      setPhotoPresetStatus('ready');
      if (successMessage) setNotice(successMessage);
      return nextPresets;
    } catch (error) {
      setPhotoPresetStatus('error');
      setNotice(buildNetworkErrorMessage('Não foi possível salvar presets de edição.', error));
      return null;
    }
  }, [setNotice]);

  const createPhotoPreset = useCallback((preset) =>
    requestPresetChange(`${API_BASE_URL}/api/admin/settings/photo-presets`, {
      method: 'POST',
      headers: adminJsonHeaders(),
      body: JSON.stringify(preset),
    }, 'Preset de edição criado.'), [adminJsonHeaders, requestPresetChange]);

  const updatePhotoPreset = useCallback((presetId, preset) =>
    requestPresetChange(`${API_BASE_URL}/api/admin/settings/photo-presets/${presetId}`, {
      method: 'PATCH',
      headers: adminJsonHeaders(),
      body: JSON.stringify(preset),
    }, 'Preset de edição atualizado.'), [adminJsonHeaders, requestPresetChange]);

  const deletePhotoPreset = useCallback((presetId) =>
    requestPresetChange(`${API_BASE_URL}/api/admin/settings/photo-presets/${presetId}`, {
      method: 'DELETE',
      headers: adminJsonHeaders(),
    }, 'Preset de edição removido.'), [adminJsonHeaders, requestPresetChange]);

  return {
    createPhotoPreset,
    deletePhotoPreset,
    loadPhotoPresets,
    photoPresets,
    photoPresetStatus,
    updatePhotoPreset,
  };
}
