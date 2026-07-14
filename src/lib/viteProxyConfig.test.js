import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { configureApiProxy, resolveApiProxyTarget } from '../../vite.config';

describe('Vite API proxy failure response', () => {
  it('uses the configured local API port', () => {
    expect(resolveApiProxyTarget({})).toBe('http://127.0.0.1:3000');
    expect(resolveApiProxyTarget({ SNAPFLOW_API_PORT: '3456' })).toBe('http://127.0.0.1:3456');
  });

  it('returns structured JSON while the backend is restarting', () => {
    const proxy = new EventEmitter();
    const response = {
      headersSent: false,
      writableEnded: false,
      writeHead: vi.fn(function writeHead() { return this; }),
      end: vi.fn(),
    };
    configureApiProxy(proxy);

    proxy.emit('error', new Error('ECONNREFUSED'), {}, response);

    expect(response.writeHead).toHaveBeenCalledWith(503, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    expect(JSON.parse(response.end.mock.calls[0][0])).toEqual(expect.objectContaining({
      code: 'api_unavailable',
    }));
  });
});
