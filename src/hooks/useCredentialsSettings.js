import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, readJsonResponse } from '../lib/apiClient';

const EMPTY_CREDENTIALS = { api: [], profile: [] };

export function useCredentialsSettings({ adminJsonHeaders, isAdminUnlocked, setNotice }) {
  const [credentialsData, setCredentialsData] = useState(EMPTY_CREDENTIALS);
  const [credentialsStatus, setCredentialsStatus] = useState('idle');

  const loadCredentials = useCallback(async ({ silent = false } = {}) => {
    if (!isAdminUnlocked) {
      setCredentialsData(EMPTY_CREDENTIALS);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/credentials`, {
        headers: adminJsonHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage('Não foi possível carregar as credenciais.', response, data));
      }
      setCredentialsData(data);
    } catch (error) {
      if (!silent) setNotice(error.message || 'Não foi possível carregar as credenciais.');
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  const saveCredential = useCallback(async ({ key, value, confirmation }) => {
    setCredentialsStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/credentials/${key}`, {
        method: 'PUT',
        headers: adminJsonHeaders(),
        body: JSON.stringify({ value, confirmation }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível salvar a credencial.', response, data));
        return false;
      }
      await loadCredentials({ silent: true });
      setNotice('Credencial salva com segurança.');
      return true;
    } finally {
      setCredentialsStatus('idle');
    }
  }, [adminJsonHeaders, loadCredentials, setNotice]);

  const deleteCredential = useCallback(async ({ key, confirmation }) => {
    setCredentialsStatus('deleting');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/credentials/${key}`, {
        method: 'DELETE',
        headers: adminJsonHeaders(),
        body: JSON.stringify({ confirmation }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível deletar a credencial.', response, data));
        return false;
      }
      await loadCredentials({ silent: true });
      setNotice('Credencial removida.');
      return true;
    } finally {
      setCredentialsStatus('idle');
    }
  }, [adminJsonHeaders, loadCredentials, setNotice]);

  useEffect(() => {
    loadCredentials({ silent: true });
  }, [loadCredentials]);

  return {
    credentialsData,
    credentialsStatus,
    deleteCredential,
    loadCredentials,
    saveCredential,
  };
}
