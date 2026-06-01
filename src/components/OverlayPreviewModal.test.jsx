import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverlayPreviewModal } from './OverlayPreviewModal';

describe('OverlayPreviewModal', () => {
  const assets = [{ id: 'overlay_1', identifier: 'Brand', url: '/overlay.png' }];

  it('updates opacity, size, position, and saves normalized draft', () => {
    const onSave = vi.fn();
    render(
      <OverlayPreviewModal
        assets={assets}
        initialAssetId="overlay_1"
        initialSettings={{ x: 0.5, y: 0.5, widthRatio: 0.3, opacity: 0.5 }}
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        previewUrl="/photo.jpg"
      />
    );

    const frame = document.querySelector('.overlay-preview-frame');
    Object.defineProperty(frame, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }),
    });
    fireEvent.pointerDown(frame, { clientX: 50, clientY: 75, pointerId: 1 });
    fireEvent.change(screen.getByLabelText(/Opacidade/i), { target: { value: '0.8' } });
    fireEvent.change(screen.getByLabelText(/Tamanho/i), { target: { value: '0.6' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar overlay/i }));

    expect(onSave).toHaveBeenCalledWith({
      assetId: 'overlay_1',
      enabled: true,
      settings: expect.objectContaining({
        x: 0.5,
        y: 0.5,
        widthRatio: 0.3,
        opacity: 0.5,
        portrait: { x: 0.25, y: 0.75, widthRatio: 0.6, opacity: 0.8 },
        landscape: { x: 0.5, y: 0.5, widthRatio: 0.3, opacity: 0.5 },
      }),
    });
  });

  it('does not reset slider values when parent rerenders while modal is open', () => {
    const onSave = vi.fn();
    const renderModal = (initialSettings = {}) => (
      <OverlayPreviewModal
        assets={[...assets]}
        initialAssetId="overlay_1"
        initialSettings={initialSettings}
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        previewUrl="/photo.jpg"
      />
    );
    const { rerender } = render(renderModal());

    fireEvent.change(screen.getByLabelText(/Tamanho/i), { target: { value: '0.9' } });
    expect(screen.getByText('90%')).toBeInTheDocument();

    rerender(renderModal({}));
    expect(screen.getByText('90%')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Opacidade/i), { target: { value: '0.4' } });
    rerender(renderModal({}));

    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Salvar overlay/i }));
    expect(onSave).toHaveBeenCalledWith({
      assetId: 'overlay_1',
      enabled: true,
      settings: expect.objectContaining({
        portrait: { x: 0.5, y: 0.5, widthRatio: 0.9, opacity: 0.4 },
        landscape: { x: 0.5, y: 0.5, widthRatio: 0.35, opacity: 0.75 },
      }),
    });
  });

  it('lets the admin drag the overlay across the preview', () => {
    const onSave = vi.fn();
    render(
      <OverlayPreviewModal
        assets={assets}
        initialAssetId="overlay_1"
        initialSettings={{ x: 0.1, y: 0.1, widthRatio: 0.35, opacity: 0.75 }}
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        previewUrl="/photo.jpg"
      />
    );

    const frame = document.querySelector('.overlay-preview-frame');
    Object.defineProperty(frame, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }),
    });
    fireEvent.pointerDown(frame, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(frame, { clientX: 180, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(frame, { pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Salvar overlay/i }));

    expect(onSave).toHaveBeenCalledWith({
      assetId: 'overlay_1',
      enabled: true,
      settings: expect.objectContaining({
        portrait: { x: 0.9, y: 0.9, widthRatio: 0.35, opacity: 0.75 },
        landscape: { x: 0.1, y: 0.1, widthRatio: 0.35, opacity: 0.75 },
      }),
    });
  });

  it('saves independent horizontal and vertical placements', () => {
    const onSave = vi.fn();
    render(
      <OverlayPreviewModal
        assets={assets}
        initialAssetId="overlay_1"
        initialSettings={{
          portrait: { x: 0.1, y: 0.1, widthRatio: 0.35, opacity: 0.75 },
          landscape: { x: 0.5, y: 0.5, widthRatio: 0.35, opacity: 0.75 },
        }}
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        previewUrl="/photo.jpg"
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Horizontal/i }));
    const landscapeFrame = document.querySelector('[data-orientation="landscape"]');
    Object.defineProperty(landscapeFrame, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }),
    });
    fireEvent.pointerDown(landscapeFrame, { clientX: 180, clientY: 20, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Salvar overlay/i }));

    expect(onSave).toHaveBeenCalledWith({
      assetId: 'overlay_1',
      enabled: true,
      settings: expect.objectContaining({
        portrait: { x: 0.1, y: 0.1, widthRatio: 0.35, opacity: 0.75 },
        landscape: { x: 0.9, y: 0.2, widthRatio: 0.35, opacity: 0.75 },
      }),
    });
  });
});
