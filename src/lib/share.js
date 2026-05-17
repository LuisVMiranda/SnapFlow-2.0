export function detectShareToken() {
  if (typeof window === 'undefined') return '';

  const pathnameMatch = window.location.pathname.match(/^\/s\/([^/]+)/);
  if (pathnameMatch?.[1]) return pathnameMatch[1];

  const params = new URLSearchParams(window.location.search);
  return params.get('share') || '';
}

export function normalizeShareCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export function buildShareWhatsAppMessage(link, code) {
  return [
    'Sua galeria privada SnapFlow foi liberada.',
    `Acessar galeria privada: ${link}`,
    `Código: ${code}`,
    'Acesso temporário com expiração automática.',
    'Acesse pelo navegador para escolher suas fotos com seguranca.',
  ].join('\n');
}
