import { useCallback } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';

export function useManualApprovalShortcut({
  adminHeaders,
  fetchDashboard,
  setNotice,
  setPendingManualSessions,
}) {
  return useCallback(async (targetSessionId) => {
    if (!targetSessionId) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/approve-manual-session/${targetSessionId}`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível liberar as fotos.', response, data));
        return false;
      }
      setPendingManualSessions((previous) => previous.filter((session) => session.id !== targetSessionId));
      setNotice('Fotos liberadas para entrega.');
      fetchDashboard({ silent: true });
      return true;
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível liberar as fotos.', error));
      return false;
    }
  }, [adminHeaders, fetchDashboard, setNotice, setPendingManualSessions]);
}
