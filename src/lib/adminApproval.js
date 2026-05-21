function safeDecode(value) {
  try {
    return decodeURIComponent(value || '');
  } catch {
    return '';
  }
}

export function buildAdminApprovalUrl(sessionId, origin = typeof window === 'undefined' ? '' : window.location.origin) {
  return `${origin}/?adminApproval=${encodeURIComponent(sessionId || '')}`;
}

export function readAdminApprovalSessionId(location = typeof window === 'undefined' ? null : window.location) {
  if (!location) return '';

  const queryValue = new URLSearchParams(location.search || '').get('adminApproval');
  if (queryValue) return queryValue;

  const pathname = String(location.pathname || '');
  const legacyEqualsMatch = pathname.match(/^\/adminApproval=([^/]+)/);
  if (legacyEqualsMatch) return safeDecode(legacyEqualsMatch[1]);

  const legacyPathMatch = pathname.match(/^\/adminApproval\/([^/]+)/);
  if (legacyPathMatch) return safeDecode(legacyPathMatch[1]);

  return '';
}
