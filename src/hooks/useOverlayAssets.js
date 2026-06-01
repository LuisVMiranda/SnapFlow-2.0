import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';

function normalizeAsset(asset, withAdminMediaToken = (url) => url) {
  if (!asset || typeof asset !== 'object') return null;
  return {
    ...asset,
    url: asset.url ? withAdminMediaToken(asset.url) : '',
  };
}

export function useOverlayAssets({
  adminHeaders,
  adminJsonHeaders,
  isAdminUnlocked,
  setNotice,
  withAdminMediaToken,
}) {
  const [overlayAssets, setOverlayAssets] = useState([]);
  const [overlayAssetStatus, setOverlayAssetStatus] = useState('idle');

  const normalizeAssets = useCallback(
    (assets) => (Array.isArray(assets) ? assets.map((asset) => normalizeAsset(asset, withAdminMediaToken)).filter(Boolean) : []),
    [withAdminMediaToken]
  );

  const loadOverlayAssets = useCallback(async ({ silent = false } = {}) => {
    if (!isAdminUnlocked) return [];
    setOverlayAssetStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/overlay-assets`, { headers: adminHeaders() });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(buildApiErrorMessage('Não foi possível carregar overlays.', response, data));
      const assets = normalizeAssets(data.assets);
      setOverlayAssets(assets);
      setOverlayAssetStatus('idle');
      return assets;
    } catch (error) {
      setOverlayAssetStatus('error');
      if (!silent) setNotice(buildNetworkErrorMessage('Não foi possível carregar overlays.', error));
      return [];
    }
  }, [adminHeaders, isAdminUnlocked, normalizeAssets, setNotice]);

  useEffect(() => {
    loadOverlayAssets({ silent: true });
  }, [loadOverlayAssets]);

  const uploadOverlayAsset = useCallback(async ({ file, identifier }) => {
    if (!isAdminUnlocked) {
      setNotice('Valide a conta administrativa antes de enviar overlays.');
      return null;
    }
    const formData = new FormData();
    formData.append('asset', file);
    if (identifier) formData.append('identifier', identifier);
    setOverlayAssetStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/overlay-assets`, {
        method: 'POST',
        headers: adminHeaders(),
        body: formData,
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível enviar o overlay.', response, data));
        setOverlayAssetStatus('error');
        return null;
      }
      const asset = normalizeAsset(data, withAdminMediaToken);
      setOverlayAssets((previous) => [asset, ...previous.filter((item) => item.id !== asset.id)]);
      setOverlayAssetStatus('idle');
      setNotice('Overlay enviado.');
      return asset;
    } catch (error) {
      setOverlayAssetStatus('error');
      setNotice(buildNetworkErrorMessage('Não foi possível enviar o overlay.', error));
      return null;
    }
  }, [adminHeaders, isAdminUnlocked, setNotice, withAdminMediaToken]);

  const updateOverlayAsset = useCallback(async (assetId, updates) => {
    setOverlayAssetStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/overlay-assets/${assetId}`, {
        method: 'PATCH',
        headers: adminJsonHeaders(),
        body: JSON.stringify(updates || {}),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível atualizar o overlay.', response, data));
        setOverlayAssetStatus('error');
        return null;
      }
      const asset = normalizeAsset(data, withAdminMediaToken);
      setOverlayAssets((previous) => previous.map((item) => (item.id === asset.id ? asset : item)));
      setOverlayAssetStatus('idle');
      setNotice('Overlay atualizado.');
      return asset;
    } catch (error) {
      setOverlayAssetStatus('error');
      setNotice(buildNetworkErrorMessage('Não foi possível atualizar o overlay.', error));
      return null;
    }
  }, [adminJsonHeaders, setNotice, withAdminMediaToken]);

  const deleteOverlayAsset = useCallback(async (assetId) => {
    setOverlayAssetStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/overlay-assets/${assetId}`, {
        method: 'DELETE',
        headers: adminJsonHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível deletar o overlay.', response, data));
        setOverlayAssetStatus('error');
        return false;
      }
      setOverlayAssets((previous) => previous.filter((item) => item.id !== assetId));
      setOverlayAssetStatus('idle');
      setNotice('Overlay deletado.');
      return true;
    } catch (error) {
      setOverlayAssetStatus('error');
      setNotice(buildNetworkErrorMessage('Não foi possível deletar o overlay.', error));
      return false;
    }
  }, [adminJsonHeaders, setNotice]);

  return {
    deleteOverlayAsset,
    loadOverlayAssets,
    overlayAssets,
    overlayAssetStatus,
    updateOverlayAsset,
    uploadOverlayAsset,
  };
}

export { normalizeAsset as normalizeOverlayAsset };
