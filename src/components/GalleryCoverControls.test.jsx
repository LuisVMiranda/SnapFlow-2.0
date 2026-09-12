import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CoverImage, CoverUploadRetry, GalleryCoverEditor, GalleryIdentityFields } from './GalleryCoverControls';
import { useGalleryCreationCover } from '../hooks/useGalleryCreationCover';

const headers = () => ({ Authorization: 'Bearer admin' });
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

it('preserves a created gallery and offers cover retry after a partial upload failure', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(reply({ error: 'offline' }, 503)).mockResolvedValueOnce(reply({ coverUrl: '/cover?v=2' }));
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useGalleryCreationCover(headers));
  const file = new File(['image'], 'cover.png', { type: 'image/png' });
  act(() => result.current.setDraft({ galleryName: 'Evento', galleryDescription: 'Festa', file }));
  await act(() => result.current.options.onGalleryCreated('saved-token'));
  expect(result.current.pending.token).toBe('saved-token');
  render(<CoverUploadRetry creation={result.current} />);
  expect(screen.getByRole('alert')).toHaveTextContent('A galeria foi salva');
  await act(() => result.current.retry());
  expect(result.current.pending).toBeNull();
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(Array(2).fill('/api/admin/share-sessions/saved-token/cover'));
  expect(fetch.mock.calls[1][1].body.get('cover')).toBe(file);
});

it('does not upload an optional missing cover and keeps metadata editable', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useGalleryCreationCover(headers));
  await act(() => result.current.options.onGalleryCreated('saved'));
  expect(fetch).not.toHaveBeenCalled();
  const onChange = vi.fn();
  render(<GalleryIdentityFields draft={result.current.draft} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Nome da galeria'), { target: { value: 'Festa' } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ galleryName: 'Festa' }));
});

it('keeps an older failed cover retry when a subsequent gallery upload succeeds', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ error: 'offline' }, 503)).mockImplementation(async () => reply({ coverUrl: '/new' })));
  const { result } = renderHook(() => useGalleryCreationCover(headers));
  act(() => result.current.setDraft({ galleryName: '', galleryDescription: '', file: new File(['image'], 'cover.png') }));
  await act(() => result.current.options.onGalleryCreated('first'));
  await act(() => result.current.options.onGalleryCreated('second'));
  expect(result.current.pending.token).toBe('first');
  await act(() => result.current.retry());
  expect(result.current.pending).toBeNull();
});

it('replaces and removes an existing cover; reports failures without losing its preview', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(reply({ error: 'inválida' }, 400))
    .mockResolvedValueOnce(reply({ coverUrl: '/new' })).mockResolvedValueOnce(reply({ coverUrl: '' }));
  vi.stubGlobal('fetch', fetch);
  render(<GalleryCoverEditor token="gallery" initialUrl="/old" adminHeaders={headers} />);
  const input = screen.getByLabelText(/Imagem de capa/);
  const file = new File(['image'], 'cover.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('inválida');
  expect(screen.getByRole('img')).toHaveAttribute('src', '/old');
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', '/new'));
  fireEvent.click(screen.getByRole('button', { name: 'Remover capa' }));
  await waitFor(() => expect(screen.queryByRole('img')).toBeNull());
});

it('hides broken images and retries a newer version', () => {
  const { rerender } = render(<CoverImage url="/cover?v=1" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.queryByRole('img')).toBeNull();
  rerender(<CoverImage url="/cover?v=2" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', '/cover?v=2');
});
