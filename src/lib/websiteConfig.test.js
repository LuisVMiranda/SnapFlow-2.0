import { expect, it } from 'vitest';
import { websiteServerOptions } from '../../vite.website.config';

it('propagates website host, ports and explicit allowed hosts, with backend port precedence', () => {
  expect(websiteServerOptions({})).toMatchObject({ host: '127.0.0.1', port: 5174, strictPort: true });
  expect(websiteServerOptions({ SNAPFLOW_WEBSITE_PORT: '5176', SNAPFLOW_WEBSITE_HOST: '127.0.0.1',
    SNAPFLOW_API_PORT: '3001', SNAPFLOW_ALLOWED_HOSTS: 'desktop-luis.tail2104cf.ts.net' }, { PORT: '3002' }))
    .toMatchObject({ port: 5176, allowedHosts: ['desktop-luis.tail2104cf.ts.net'], proxy: { '/api': { target: 'http://127.0.0.1:3002' } } });
  expect(() => websiteServerOptions({ SNAPFLOW_WEBSITE_PORT: '5173' })).toThrow(/portas diferentes/);
  expect(() => websiteServerOptions({ SNAPFLOW_WEBSITE_PORT: 'invalid' })).toThrow(/Porta inválida/);
});
