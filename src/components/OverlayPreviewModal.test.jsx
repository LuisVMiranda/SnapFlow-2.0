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
      settings: { x: 0.25, y: 0.75, widthRatio: 0.6, opacity: 0.8 },
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
      settings: { x: 0.5, y: 0.5, widthRatio: 0.9, opacity: 0.4 },
    });
  });
});
