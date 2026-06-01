import { useCallback } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';
import { draftFromShare } from '../lib/sharedLinksPanel';
import { normalizeOverlaySettings } from './useOverlaySettings';

export function useGalleryOverlayActions({
  adminJsonHeaders,
  drafts,
  fetchDashboard,
  loadShareDetails,
  setNotice,
  setPhotoActionToken,
}) {
  const refreshGallery = useCallback(async (shareSession) => {
    await loadShareDetails(shareSession);
    fetchDashboard({ silent: true });
  }, [fetchDashboard, loadShareDetails]);

  const applyGalleryOverlay = useCallback(async (shareSession, overlayDraft = {}) => {
    const draft = drafts[shareSession.token] || draftFromShare(shareSession);
    const assetId = overlayDraft.assetId || draft.overlayAssetId;
    if (!assetId) {
      setNotice('Selecione um overlay para aplicar nesta galeria.');
      return;
    }
    setPhotoActionToken(shareSession.token);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/overlay`, {
        method: 'PATCH',
        headers: adminJsonHeaders(),
        body: JSON.stringify({
          assetId,
          enabled: overlayDraft.enabled ?? true,
          settings: normalizeOverlaySettings(overlayDraft.settings || draft.overlaySettings),
        }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível aplicar o overlay nesta galeria.', response, data));
        return;
      }
      setNotice(`Overlay atualizado em ${data.changedPhotoCount || 0} foto(s).`);
      await refreshGallery(shareSession);
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível aplicar o overlay nesta galeria.', error));
    } finally {
      setPhotoActionToken('');
    }
  }, [adminJsonHeaders, drafts, refreshGallery, setNotice, setPhotoActionToken]);

  const clearGalleryOverlay = useCallback(async (shareSession) => {
    setPhotoActionToken(shareSession.token);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/share-sessions/${shareSession.token}/overlay`, {
        method: 'DELETE',
        headers: adminJsonHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível remover o overlay desta galeria.', response, data));
        return;
      }
      setNotice(`Overlay removido em ${data.changedPhotoCount || 0} foto(s).`);
      await refreshGallery(shareSession);
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível remover o overlay desta galeria.', error));
    } finally {
      setPhotoActionToken('');
    }
  }, [adminJsonHeaders, refreshGallery, setNotice, setPhotoActionToken]);

  return { applyGalleryOverlay, clearGalleryOverlay };
}
