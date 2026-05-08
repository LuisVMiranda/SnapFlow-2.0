import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';

export function useWhatsAppTemplates({ adminJsonHeaders, isAdminUnlocked, setNotice }) {
  const [whatsAppTemplates, setWhatsAppTemplates] = useState(null);
  const [whatsAppTemplateStatus, setWhatsAppTemplateStatus] = useState('idle');

  const loadWhatsAppTemplates = useCallback(async ({ silent = false } = {}) => {
    if (!isAdminUnlocked) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/whatsapp-messages`, {
        headers: adminJsonHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage('Não foi possível carregar as mensagens do WhatsApp.', response, data));
      }
      setWhatsAppTemplates(data);
      return data;
    } catch (error) {
      if (!silent) setNotice(buildNetworkErrorMessage('Não foi possível carregar as mensagens do WhatsApp.', error));
      return null;
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  useEffect(() => {
    loadWhatsAppTemplates({ silent: true });
  }, [loadWhatsAppTemplates]);

  const saveWhatsAppTemplates = useCallback(async (templates) => {
    if (!isAdminUnlocked) {
      setNotice('Valide a conta administrativa antes de salvar as mensagens.');
      return false;
    }

    setWhatsAppTemplateStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/whatsapp-messages`, {
        method: 'PUT',
        headers: adminJsonHeaders(),
        body: JSON.stringify(templates),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível salvar as mensagens do WhatsApp.', response, data));
        setWhatsAppTemplateStatus('error');
        return false;
      }

      setWhatsAppTemplates(data);
      setWhatsAppTemplateStatus('saved');
      setNotice('Mensagens do WhatsApp salvas.');
      return true;
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível salvar as mensagens do WhatsApp.', error));
      setWhatsAppTemplateStatus('error');
      return false;
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  return {
    loadWhatsAppTemplates,
    saveWhatsAppTemplates,
    whatsAppTemplates,
    whatsAppTemplateStatus,
  };
}
