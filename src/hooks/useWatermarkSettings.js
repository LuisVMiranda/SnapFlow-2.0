import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';

export const DEFAULT_WATERMARK_SETTINGS = {
  width: 420,
  height: 140,
  opacity: 0.55,
  instances: 1,
};

export function normalizeWatermarkSettings(value = {}) {
  const numberOr = (field, fallback) => {
    const parsed = Number(value[field]);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    width: Math.min(900, Math.max(120, Math.round(numberOr('width', DEFAULT_WATERMARK_SETTINGS.width)))),
    height: Math.min(360, Math.max(40, Math.round(numberOr('height', DEFAULT_WATERMARK_SETTINGS.height)))),
    opacity: Number(Math.min(0.95, Math.max(0.05, numberOr('opacity', DEFAULT_WATERMARK_SETTINGS.opacity))).toFixed(2)),
    instances: Math.min(24, Math.max(1, Math.round(numberOr('instances', DEFAULT_WATERMARK_SETTINGS.instances)))),
  };
}

export function useWatermarkSettings({ adminJsonHeaders, isAdminUnlocked, setNotice }) {
  const [watermarkSettings, setWatermarkSettings] = useState(DEFAULT_WATERMARK_SETTINGS);
  const [watermarkSettingsStatus, setWatermarkSettingsStatus] = useState('idle');

  const loadWatermarkSettings = useCallback(async ({ silent = false } = {}) => {
    if (!isAdminUnlocked) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/watermark`, {
        headers: adminJsonHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage("Não foi possível carregar a marca d'água.", response, data));
      }
      const normalized = normalizeWatermarkSettings(data);
      setWatermarkSettings(normalized);
      return normalized;
    } catch (error) {
      if (!silent) setNotice(buildNetworkErrorMessage("Não foi possível carregar a marca d'água.", error));
      return null;
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  useEffect(() => {
    loadWatermarkSettings({ silent: true });
  }, [loadWatermarkSettings]);

  const saveWatermarkSettings = useCallback(async (settings) => {
    if (!isAdminUnlocked) {
      setNotice("Valide a conta administrativa antes de salvar a marca d'água.");
      return false;
    }

    setWatermarkSettingsStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/settings/watermark`, {
        method: 'PUT',
        headers: adminJsonHeaders(),
        body: JSON.stringify(normalizeWatermarkSettings(settings)),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage("Não foi possível salvar a marca d'água.", response, data));
        setWatermarkSettingsStatus('error');
        return false;
      }

      setWatermarkSettings(normalizeWatermarkSettings(data));
      setWatermarkSettingsStatus('saved');
      setNotice("Marca d'água das prévias salva.");
      return true;
    } catch (error) {
      setNotice(buildNetworkErrorMessage("Não foi possível salvar a marca d'água.", error));
      setWatermarkSettingsStatus('error');
      return false;
    }
  }, [adminJsonHeaders, isAdminUnlocked, setNotice]);

  return {
    loadWatermarkSettings,
    saveWatermarkSettings,
    watermarkSettings,
    watermarkSettingsStatus,
  };
}
