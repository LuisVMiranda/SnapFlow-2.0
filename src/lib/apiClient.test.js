import { describe, expect, it } from 'vitest';
import { buildApiErrorMessage, readJsonResponse } from './apiClient';

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

    expect(data.code).toBe('html_api_response');
    expect(data.error).toContain('Reinicie o backend');
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
});
