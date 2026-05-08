import { describe, expect, it } from 'vitest';
import { buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from './apiClient';

describe('API response reader', () => {
  it('reads JSON responses directly', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    });

    await expect(readJsonResponse(response)).resolves.toEqual({ ok: true });
  });

  it('wraps plain text failures into an error object', async () => {
    const response = new Response('boom', {
      headers: { 'content-type': 'text/plain' },
    });

    await expect(readJsonResponse(response)).resolves.toEqual({ error: 'boom' });
  });

  it('converts HTML API failures into an actionable JSON-like error', async () => {
    const response = new Response('<!DOCTYPE html><html><body><pre>Cannot POST /api/admin/share-sessions/x/recreate</pre></body></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

    const data = await readJsonResponse(response);
    const message = buildApiErrorMessage('Não foi possível completar a ação.', { status: 404 }, data);

    expect(data.code).toBe('html_api_response');
    expect(data.error).toContain('página HTML');
    expect(message).toContain('O painel recebeu HTML');
    expect(data.details.reason).toContain('Cannot POST');
  });

  it('adds structured upload details to error messages', () => {
    const response = { status: 413 };
    const message = buildApiErrorMessage('Upload falhou.', response, {
      error: 'Arquivo muito grande.',
      code: 'upload_file_too_large',
      details: { maxUploadMb: 25 },
    });

    expect(message).toContain('HTTP 413');
    expect(message).toContain('Arquivo muito grande.');
    expect(message).toContain('Limite por arquivo: 25 MB');
  });

  it('turns raw fetch failures into an actionable backend connectivity hint', () => {
    const message = buildNetworkErrorMessage(
      'Não foi possível gerar o link compartilhado.',
      new TypeError('Failed to fetch')
    );

    expect(message).toContain('Não foi possível conectar ao backend.');
    expect(message).toContain('/api/health');
  });

  it('keeps structured API errors readable when the backend responds', () => {
    const message = buildNetworkErrorMessage(
      'Não foi possível gerar o link compartilhado.',
      new Error('HTTP 500 | Erro interno do servidor | Código: 42703')
    );

    expect(message).toContain('HTTP 500');
    expect(message).not.toContain('/api/health');
  });

  it('does not repeat prefixes already present in structured errors', () => {
    const message = buildNetworkErrorMessage(
      'Não foi possível gerar o link compartilhado.',
      new Error('Não foi possível gerar o link compartilhado. | HTTP 400 | Telefone inválido')
    );

    expect(message.match(/Não foi possível gerar o link compartilhado/g)).toHaveLength(1);
  });

  it('adds practical guidance based on backend error codes', () => {
    const message = buildApiErrorMessage('Não foi possível gerar o Pix.', { status: 500 }, {
      error: 'Token Mercado Pago ausente.',
      code: 'mp_token_missing',
    });

    expect(message).toContain('Código: mp_token_missing');
    expect(message).toContain('Configure o token do Mercado Pago');
  });
});
