import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';

function normalizeAsset(asset, withAdminMediaToken = (url) => url) {
  if (!asset || typeof asset !== 'object') return null;
  return {
    ...asset,
    url: asset.url ? withAdminMediaToken(asset.url) : '',
  };
}

export function useWatermarkAssets({
  adminHeaders,
  adminJsonHeaders,
  isAdminUnlocked,
  setNotice,
  withAdminMediaToken,
}) {
  const [watermarkAssets, setWatermarkAssets] = useState([]);
  const [watermarkAssetStatus, setWatermarkAssetStatus] = useState('idle');

  const normalizeAssets = useCallback(
    (assets) => (Array.isArray(assets) ? assets.map((asset) => normalizeAsset(asset, withAdminMediaToken)).filter(Boolean) : []),
    [withAdminMediaToken]
  );

  const loadWatermarkAssets = useCallback(async ({ silent = false } = {}) => {
    if (!isAdminUnlocked) return [];
    setWatermarkAssetStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/watermark-assets`, {
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(buildApiErrorMessage("Não foi possível carregar marcas d'água.", response, data));
      }
      const assets = normalizeAssets(data.assets);
      setWatermarkAssets(assets);
      setWatermarkAssetStatus('idle');
      return assets;
    } catch (error) {
      setWatermarkAssetStatus('error');
      if (!silent) setNotice(buildNetworkErrorMessage("Não foi possível carregar marcas d'água.", error));
      return [];
    }
  }, [adminHeaders, isAdminUnlocked, normalizeAssets, setNotice]);

  useEffect(() => {
    loadWatermarkAssets({ silent: true });
  }, [loadWatermarkAssets]);

  const uploadWatermarkAsset = useCallback(async ({ file, name }) => {
    if (!isAdminUnlocked) {
      setNotice("Valide a conta administrativa antes de enviar marcas d'água.");
      return null;
    }
    const formData = new FormData();
    formData.append('asset', file);
    if (name) formData.append('name', name);
    setWatermarkAssetStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/watermark-assets`, {
        method: 'POST',
        headers: adminHeaders(),
        body: formData,
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage("Não foi possível enviar a marca d'água.", response, data));
        setWatermarkAssetStatus('error');
        return null;
      }
      const asset = normalizeAsset(data, withAdminMediaToken);
      setWatermarkAssets((previous) => [asset, ...previous.filter((item) => item.id !== asset.id)]);
      setWatermarkAssetStatus('idle');
      setNotice("Marca d'água enviada.");
      return asset;
    } catch (error) {
      setWatermarkAssetStatus('error');
      setNotice(buildNetworkErrorMessage("Não foi possível enviar a marca d'água.", error));
      return null;
    }
  }, [adminHeaders, isAdminUnlocked, setNotice, withAdminMediaToken]);

  const updateWatermarkAsset = useCallback(async (assetId, updates) => {
    setWatermarkAssetStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/watermark-assets/${assetId}`, {
        method: 'PATCH',
        headers: adminJsonHeaders(),
        body: JSON.stringify(updates || {}),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage("Não foi possível atualizar a marca d'água.", response, data));
        setWatermarkAssetStatus('error');
        return null;
      }
      const asset = normalizeAsset(data, withAdminMediaToken);
      setWatermarkAssets((previous) => previous.map((item) => (item.id === asset.id ? asset : item)));
      setWatermarkAssetStatus('idle');
      setNotice("Marca d'água atualizada.");
      return asset;
    } catch (error) {
      setWatermarkAssetStatus('error');
      setNotice(buildNetworkErrorMessage("Não foi possível atualizar a marca d'água.", error));
      return null;
    }
  }, [adminJsonHeaders, setNotice, withAdminMediaToken]);

  const deleteWatermarkAsset = useCallback(async (assetId) => {
    setWatermarkAssetStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/watermark-assets/${assetId}`, {
        method: 'DELETE',
        headers: adminJsonHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage("Não foi possível deletar a marca d'água.", response, data));
        setWatermarkAssetStatus('error');
        return false;
      }
      setWatermarkAssets((previous) => previous.filter((item) => item.id !== assetId));
      setWatermarkAssetStatus('idle');
      setNotice("Marca d'água deletada.");
      return true;
    } catch (error) {
      setWatermarkAssetStatus('error');
      setNotice(buildNetworkErrorMessage("Não foi possível deletar a marca d'água.", error));
      return false;
    }
  }, [adminJsonHeaders, setNotice]);

  return {
    deleteWatermarkAsset,
    loadWatermarkAssets,
    updateWatermarkAsset,
    uploadWatermarkAsset,
    watermarkAssets,
    watermarkAssetStatus,
  };
}

export { normalizeAsset as normalizeWatermarkAsset };
