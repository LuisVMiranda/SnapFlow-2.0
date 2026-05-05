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

  const saveCredentialsBatch = useCallback(async ({ changes, confirmation }) => {
    setCredentialsStatus('saving');
    const results = {};
    try {
      for (const change of changes) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/admin/credentials/${change.key}`, {
            method: 'PUT',
            headers: adminJsonHeaders(),
            body: JSON.stringify({ value: change.value, confirmation }),
          });
          const data = await readJsonResponse(response);
          results[change.key] = response.ok
            ? { status: 'saved' }
            : { status: 'failed', error: buildApiErrorMessage('Não foi possível salvar a credencial.', response, data) };
        } catch (error) {
          results[change.key] = { status: 'failed', error: error.message || 'Não foi possível salvar a credencial.' };
        }
      }
      await loadCredentials({ silent: true });
      const failed = Object.values(results).filter((result) => result.status === 'failed').length;
      setNotice(failed ? `${failed} credencial(is) não foram salvas.` : 'Credenciais salvas com segurança.');
      return { ok: failed === 0, results };
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
    saveCredentialsBatch,
  };
}
