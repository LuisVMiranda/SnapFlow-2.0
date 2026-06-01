export const API_BASE_URL = '';

const CODE_HINTS = {
  admin_locked: 'O bloqueio é temporário. Aguarde a liberação automática antes de tentar novamente.',
  admin_required: 'Entre novamente com a credencial administrativa no botão Conta.',
  admin_token_missing: 'Configure ADMIN_ACCESS_TOKEN no arquivo backend\\.env.local e reinicie o servidor.',
  api_route_not_found: 'O backend em execução está desatualizado. Rode as migrações, reinicie a janela APP FOTOGRAFIA - SERVIDOR e tente de novo.',
  credential_confirmation_invalid: 'Digite a mesma credencial administrativa usada para entrar no painel.',
  credential_not_found: 'Atualize a página de Credenciais e tente novamente.',
  credential_value_required: 'Preencha o novo valor ou deixe o campo sem alteração.',
  credentials_secret_missing: 'Rode o instalador ou configure CREDENTIALS_SECRET em backend\\.env.local.',
  delivery_job_not_found: 'Atualize a aba Vendas e tente novamente.',
  discount_exceeds_total: 'Revise o subtotal desta venda ou reduza o desconto manual.',
  file_not_found: 'A foto pode ter sido removida pela retenção ou pela edição da galeria.',
  html_api_response: 'O painel recebeu HTML em vez de JSON. Isso costuma acontecer quando a rota ainda não existe no backend em execução.',
  invalid_client_email: 'Corrija o e-mail do cliente ou deixe o campo em branco.',
  invalid_discount_amount: 'Informe um valor numérico maior que zero para o desconto ou desative a opção.',
  invalid_file_path: 'Use apenas arquivos dentro da pasta privada de armazenamento do SnapFlow.',
  invalid_file_type: 'Envie fotos em JPG, PNG ou WebP.',
  invalid_share_code: 'Digite exatamente os 4 caracteres enviados com o link da galeria.',
  media_access_denied: 'Abra novamente o link da galeria e informe o código de acesso.',
  media_share_mismatch: 'Atualize a galeria e selecione a foto novamente.',
  media_variant_not_found: 'Atualize a página e tente abrir a foto novamente.',
  mp_webhook_secret_missing: 'Configure o segredo do webhook do Mercado Pago para confirmar pagamentos automaticamente.',
  mp_token_missing: 'Configure o token do Mercado Pago em Credenciais antes de gerar Pix.',
  package_options_required: 'Mantenha pelo menos um pacote ativo nas Configurações.',
  photo_delete_failed: 'Alguns arquivos locais da foto não puderam ser removidos. Verifique permissões da pasta storage.',
  photo_not_found: 'Atualize a galeria: a foto pode ter sido removida ou expirada.',
  photo_share_mismatch: 'Atualize a página e selecione as fotos novamente.',
  phone_invalid_country_code: 'Revise o DDI informado. Exemplo: 55 para Brasil ou 54 para Argentina.',
  phone_invalid_ddd: 'Confira o DDD brasileiro do cliente.',
  phone_invalid_length: 'Revise o DDI e o número local. O WhatsApp aceita até 15 dígitos somando ambos.',
  phone_invalid_mobile: 'Para celular brasileiro com 11 dígitos, o número deve ter 9 depois do DDD.',
  phone_required: 'Informe o WhatsApp do cliente antes de continuar.',
  photos_required: 'Selecione ao menos uma foto antes de continuar.',
  session_not_approved: 'Libere o pagamento no painel antes de reenviar as fotos.',
  session_not_found: 'Atualize o painel e confirme se a venda ainda existe.',
  invalid_subtotal_amount: 'Atualize a venda, confira a quantidade de fotos e tente novamente.',
  share_photos_missing: 'Abra Ver/Editar e adicione fotos antes de recriar o link.',
  share_expired: 'Recrie a galeria ou estenda o tempo de acesso.',
  share_not_found: 'Atualize a lista de galerias e confirme se o link não foi excluído.',
  upload_empty: 'Selecione uma ou mais imagens e tente enviar novamente.',
  upload_file_count_exceeded: 'Envie menos fotos por vez ou ajuste MAX_FILES_PER_UPLOAD no backend.',
  upload_file_too_large: 'Reduza o tamanho da foto ou aumente MAX_UPLOAD_MB no backend.',
  watermark_asset_in_use: "Remova esta marca d'água das galerias antes de deletar.",
  watermark_asset_invalid_type: "Envie uma marca d'água em PNG, JPG ou WebP.",
  watermark_asset_not_found: "Atualize a lista de marcas d'água e tente novamente.",
  watermark_asset_required: "Selecione ou envie uma marca d'água antes de continuar.",
  watermark_asset_too_large: "Use uma imagem de marca d'água com até 5 MB.",
  whatsapp_template_not_found: 'Atualize Configurações e tente salvar novamente.',
  webhook_signature_invalid: 'Confira o segredo do webhook configurado no Mercado Pago e no SnapFlow.',
  webhook_signature_missing: 'O Mercado Pago enviou a notificação sem assinatura. Confira a configuração do webhook.',
  whatsapp_unavailable: 'Abra Galerias, verifique o cartão WhatsApp de envio e use Reconectar WhatsApp se necessário.',
};

function statusHint(status) {
  if (!status) return '';
  if (status === 400) return 'Revise os dados preenchidos e tente novamente.';
  if (status === 401 || status === 403) return 'Verifique a credencial administrativa ou o código de acesso da galeria.';
  if (status === 404) return 'Confirme se o backend foi reiniciado depois da atualização e se a rota existe na versão atual.';
  if (status === 409) return 'Atualize a tela: esta venda ou galeria pode já ter mudado de estado.';
  if (status === 413) return 'O envio ultrapassou o limite configurado para arquivos.';
  if (status === 429) return 'Aguarde alguns minutos antes de tentar novamente.';
  if (status === 502 || status === 503) return 'O painel não conseguiu falar com a API. Confira se a janela APP FOTOGRAFIA - SERVIDOR continua aberta; se ela fechou, reinicie o backend e tente novamente.';
  if (status >= 500) return 'Verifique o terminal APP FOTOGRAFIA - SERVIDOR para detalhes e reinicie o backend se a falha persistir.';
  return '';
}

export async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  const trimmed = text.trim().toLowerCase();
  if (contentType.includes('text/html') || trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    return {
      error: 'A API respondeu uma página HTML em vez de JSON.',
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
  if (response.status) parts.push(`HTTP ${response.status}`);
  if (data.error) parts.push(data.error);
  if (data.code) parts.push(`Código: ${data.code}`);

  const details = data.details || {};
  if (details.maxUploadMb) parts.push(`Limite por arquivo: ${details.maxUploadMb} MB`);
  if (details.maxFilesPerUpload) parts.push(`Limite por envio: ${details.maxFilesPerUpload} arquivos`);
  if (details.receivedType) parts.push(`Tipo recebido: ${details.receivedType}`);
  if (details.reason) parts.push(`Detalhe técnico: ${details.reason}`);
  if (details.lockedUntil) parts.push(`Liberação automática: ${new Date(details.lockedUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
  if (details.retryAfterSeconds) parts.push(`Tempo aproximado: ${Math.ceil(Number(details.retryAfterSeconds) / 60)} minuto(s)`);
  if (Array.isArray(details.allowedTypes)) parts.push(`Tipos permitidos: ${details.allowedTypes.join(', ')}`);

  const hint = CODE_HINTS[data.code] || statusHint(response.status);
  if (hint) parts.push(`Orientação: ${hint}`);

  return parts.filter(Boolean).join(' | ');
}

export function buildNetworkErrorMessage(prefix, error) {
  const rawMessage = String(error.message || '').trim();
  const lowerMessage = rawMessage.toLowerCase();
  const networkFailure =
    error.name === 'TypeError' ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('networkerror') ||
    lowerMessage.includes('load failed');

  if (!networkFailure) {
    if (prefix && rawMessage.startsWith(prefix)) return rawMessage;
    return [prefix, rawMessage || 'Erro desconhecido.'].filter(Boolean).join(' | ');
  }

  return [
    prefix,
    'Não foi possível conectar ao backend.',
    'Confirme se a janela APP FOTOGRAFIA - SERVIDOR está aberta, teste http://127.0.0.1:3000/api/health no navegador e reinicie o backend depois de atualizar o código ou rodar migrações.',
  ].join(' ');
}
