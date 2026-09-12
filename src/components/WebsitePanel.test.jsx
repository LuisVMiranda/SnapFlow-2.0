import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WebsitePanel } from './WebsitePanel';

const data = { websiteUrl: 'https://site.test', galleryBaseUrl: 'https://gallery.test', contact: { enabled: true, label: 'WhatsApp' },
  settings: { eligiblePackageTypes: ['eventos'] }, packages: { eventos: { shortLabel: 'Eventos' }, escola: { shortLabel: 'Escola' } },
  galleries: ['Primeira', 'Segunda'].map((title, index) => ({ title, token: `g${index}`, coverUrl: '/cover', galleryUrl: 'https://gallery.test/s/g' })) };
const headers = () => ({ Authorization: 'Bearer admin' });
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

it('copies URL, reorders, filters, searches pages and publishes/unpublishes', async () => {
  const fetch = vi.fn().mockImplementation(async (url) => url.includes('?') ? reply({ items: [{ token: 'found', title: 'Encontrada', eligible: true }], nextCursor: '25' }) : reply(data));
  vi.stubGlobal('fetch', fetch);
  const writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<WebsitePanel adminHeaders={headers} />);
  await screen.findByText('1. Primeira');
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(data.websiteUrl));
  fireEvent.click(screen.getByRole('button', { name: 'Descer Primeira' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/order', expect.objectContaining({ body: JSON.stringify({ tokens: ['g1', 'g0'] }) })));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar tipos' })).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Escola'));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar tipos' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/settings', expect.objectContaining({ body: JSON.stringify({ eligiblePackageTypes: ['eventos', 'escola'] }) })));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar tipos' })).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar galerias' }), { target: { value: 'Festa & amigos' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByText('Encontrada — Disponível');
  expect(fetch.mock.calls.at(-1)[0]).toContain('query=Festa+%26+amigos');
  fireEvent.click(screen.getByRole('button', { name: 'Carregar mais galerias' }));
  await waitFor(() => expect(fetch.mock.calls.at(-1)[0]).toContain('cursor=25'));
  fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar ao website' })[0]);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/galleries/found', expect.objectContaining({ method: 'POST' })));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remover do website' })[0]).toBeEnabled());
  fireEvent.click(screen.getAllByRole('button', { name: 'Remover do website' })[0]);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/galleries/g0', expect.objectContaining({ method: 'DELETE' })));
});

it('shows missing configuration, failed search and loading failure with a retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ error: 'offline' }, 503))
    .mockResolvedValueOnce(reply({ ...data, websiteUrl: '', galleryBaseUrl: '', contact: { enabled: false }, galleries: [] }))
    .mockResolvedValue(reply({ error: 'busca indisponível' }, 503)));
  render(<WebsitePanel adminHeaders={headers} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('offline');
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar website' }));
  await screen.findByText(/Configure PUBLIC_WEBSITE_URL/);
  expect(screen.getByRole('button', { name: 'Copiar link' })).toBeDisabled();
  expect(screen.getByText(/Cadastre um telefone comercial/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByText('busca indisponível');
});
