import { useCallback, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';

const DEFAULT_RETENTION_SETTINGS = {
  defaultGalleryRetentionDays: 30,
  deliveredPhotoRetentionDays: 30,
  expiredShareRetentionDays: 7,
  archiveBeforeDelete: false,
  autoCleanupEnabled: false,
};

export function useRetentionControls({ adminHeaders, adminJsonHeaders, isAdminUnlocked, setNotice }) {
  const [retentionSettings, setRetentionSettings] = useState(DEFAULT_RETENTION_SETTINGS);
  const [cleanupPreview, setCleanupPreview] = useState(null);

  const fetchRetentionSettings = useCallback(async () => {
    if (!isAdminUnlocked) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/retention`, {
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (response.ok) setRetentionSettings(data);
    } catch (error) {
      console.warn('Falha ao carregar retenção:', error);
    }
  }, [adminHeaders, isAdminUnlocked]);

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

  return {
    cleanupPreview,
    fetchRetentionSettings,
    previewCleanup,
    retentionSettings,
    runCleanup,
    saveRetentionSettings,
    setRetentionSettings,
  };
}
