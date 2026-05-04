export function normalizePhotoUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window === 'undefined') return url;

  return new URL(url, window.location.origin).toString();
}

export function photoIdFromUrl(url, index) {
  const normalizedUrl = normalizePhotoUrl(url);
  const filename = normalizedUrl.split('/').pop();
  return filename || `photo-${index}`;
}
