import { buildApiUrl, readJsonResponse } from './apiClient';

export async function websiteRequest(path, options = {}) {
  const response = await fetch(buildApiUrl(path), options);
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar o website.');
  return data;
}

export function uploadGalleryCover(token, file, headers) {
  const body = new FormData();
  body.append('cover', file);
  return websiteRequest(`/api/admin/share-sessions/${encodeURIComponent(token)}/cover`, {
    method: 'PUT', headers: headers(), body,
  });
}

export function galleryIdentityPayload(options = {}) {
  return { galleryName: options.galleryName, galleryDescription: options.galleryDescription };
}

export async function finishGalleryCover(options, data) {
  if (options.onGalleryCreated) await options.onGalleryCreated(data.token || data.shareToken);
}
