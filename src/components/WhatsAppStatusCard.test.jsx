import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppStatusCard } from './WhatsAppStatusCard';

function response(body, status = 200, contentType = 'application/json') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': contentType }),
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

describe('WhatsAppStatusCard backend restart recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries a transient proxy 502 without alarming the photographer', async () => {
    const setNotice = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(response('Bad Gateway', 502, 'text/plain'))
      .mockResolvedValueOnce(response({ ready: true, status: 'ready', lastError: null }));

    render(<WhatsAppStatusCard adminHeaders={() => ({ Authorization: 'Bearer admin' })} setNotice={setNotice} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(setNotice).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText('PRONTO')).toBeInTheDocument();
    expect(setNotice).not.toHaveBeenCalled();
  });

  it('announces only sustained downtime and confirms automatic recovery', async () => {
    const setNotice = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ error: 'API iniciando', code: 'api_unavailable' }, 503))
      .mockResolvedValueOnce(response({ error: 'API iniciando', code: 'api_unavailable' }, 503))
      .mockResolvedValueOnce(response({ error: 'API iniciando', code: 'api_unavailable' }, 503))
      .mockResolvedValueOnce(response({ ready: true, status: 'ready', lastError: null }));

    render(<WhatsAppStatusCard adminHeaders={() => ({ Authorization: 'Bearer admin' })} setNotice={setNotice} />);
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(screen.getByText('INDISPONÍVEL')).toBeInTheDocument();
    expect(setNotice).toHaveBeenCalledTimes(1);
    expect(setNotice.mock.calls[0][0]).toContain('HTTP 503');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    expect(screen.getByText('PRONTO')).toBeInTheDocument();
    expect(setNotice).toHaveBeenLastCalledWith('Conexão com o servidor restabelecida. Status do WhatsApp atualizado.');
  });

  it('reports a non-transient authorization failure immediately', async () => {
    const setNotice = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValueOnce(response({
      error: 'Acesso administrativo inválido.',
      code: 'admin_required',
    }, 401));

    render(<WhatsAppStatusCard adminHeaders={() => ({ Authorization: 'Bearer inválido' })} setNotice={setNotice} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setNotice).toHaveBeenCalledTimes(1);
    expect(setNotice.mock.calls[0][0]).toContain('HTTP 401');
    expect(screen.getByText('INDISPONÍVEL')).toBeInTheDocument();
  });

  it('keeps a slower heartbeat after ready so later disconnects are visible', async () => {
    const setNotice = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ ready: true, status: 'ready', lastError: null }))
      .mockResolvedValueOnce(response({ ready: false, status: 'disconnected', lastError: 'WhatsApp desconectado: LOGOUT' }));

    render(<WhatsAppStatusCard adminHeaders={() => ({ Authorization: 'Bearer admin' })} setNotice={setNotice} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('PRONTO')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText('DESCONECTADO')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp desconectado: LOGOUT')).toBeInTheDocument();
    expect(setNotice).not.toHaveBeenCalled();
  });
});
