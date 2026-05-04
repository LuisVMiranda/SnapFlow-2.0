export const API_BASE_URL = '';

export async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  const trimmed = text.trim().toLowerCase();
  if (contentType.includes('text/html') || trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    return {
      error: 'A API respondeu uma página HTML em vez de JSON. Reinicie o backend para carregar as rotas administrativas mais recentes.',
      code: 'html_api_response',
      details: {
        reason: text.replace(/\s+/g, ' ').slice(0, 180),
      },
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text || 'Resposta inválida do servidor.' };
  }
}

export function buildApiErrorMessage(prefix, response, data = {}) {
  const parts = [prefix];
  if (response?.status) parts.push(`HTTP ${response.status}`);
  if (data.error) parts.push(data.error);
  if (data.code) parts.push(`Código: ${data.code}`);

  const details = data.details || {};
  if (details.maxUploadMb) parts.push(`Limite por arquivo: ${details.maxUploadMb} MB`);
  if (details.maxFilesPerUpload) parts.push(`Limite por envio: ${details.maxFilesPerUpload} arquivos`);
  if (details.receivedType) parts.push(`Tipo recebido: ${details.receivedType}`);
  if (details.reason) parts.push(`Detalhe técnico: ${details.reason}`);
  if (Array.isArray(details.allowedTypes)) parts.push(`Tipos permitidos: ${details.allowedTypes.join(', ')}`);

  return parts.filter(Boolean).join(' | ');
}
