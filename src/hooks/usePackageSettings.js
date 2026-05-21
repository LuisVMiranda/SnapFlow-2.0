import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';
import { DEFAULT_PRICING, firstPackageKey, normalizePricingOptions } from '../lib/pricing';

export function usePackageSettings({ adminJsonHeaders, currentType, isAdminUnlocked, preserveUnknownType = false, setNotice, setType }) {
  const [pricingOptions, setPricingOptions] = useState(DEFAULT_PRICING);
  const [packageSettingsStatus, setPackageSettingsStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    const loadPackages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/packages`);
        const data = await readJsonResponse(response);
        if (!response.ok) throw new Error(buildApiErrorMessage('Não foi possível carregar os pacotes.', response, data));
        if (!cancelled) {
          setPricingOptions(normalizePricingOptions(data));
          setPackageSettingsStatus('idle');
        }
      } catch (error) {
        console.warn('Falha ao carregar pacotes:', error);
        if (!cancelled) setPackageSettingsStatus('error');
      }
    };

    loadPackages();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (packageSettingsStatus === 'loading') return;
    if (pricingOptions[currentType] || preserveUnknownType) return;
    setType(firstPackageKey(pricingOptions));
  }, [currentType, packageSettingsStatus, preserveUnknownType, pricingOptions, setType]);

  const savePackageSettings = useCallback(async (draft) => {
    if (!isAdminUnlocked) {
      setNotice('Valide a conta administrativa antes de salvar os pacotes.');
      return false;
    }

    setPackageSettingsStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/packages`, {
        method: 'PUT',
        headers: adminJsonHeaders(),
        body: JSON.stringify(normalizePricingOptions(draft)),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível salvar os pacotes.', response, data));
        setPackageSettingsStatus('error');
        return false;
      }

      const normalized = normalizePricingOptions(data);
      setPricingOptions(normalized);
      if (!normalized[currentType] && !preserveUnknownType) setType(firstPackageKey(normalized));
      setNotice('Pacotes de fotos salvos.');
      setPackageSettingsStatus('saved');
      return true;
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível salvar os pacotes.', error));
      setPackageSettingsStatus('error');
      return false;
    }
  }, [adminJsonHeaders, currentType, isAdminUnlocked, preserveUnknownType, setNotice, setType]);

  return { packageSettingsStatus, pricingOptions, savePackageSettings };
}
