import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverlayAssetLibraryPanel } from './OverlayAssetLibraryPanel';

describe('OverlayAssetLibraryPanel', () => {
  it('uploads overlay with identifier and file', async () => {
    const uploadAsset = vi.fn().mockResolvedValue({ id: 'overlay_1' });
    render(<OverlayAssetLibraryPanel uploadAsset={uploadAsset} />);

    fireEvent.change(screen.getByLabelText(/Identificador/i), { target: { value: 'brand-frame' } });
    fireEvent.change(screen.getByLabelText(/Imagem/i), {
      target: { files: [new File(['x'], 'overlay.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar overlay/i }));

    expect(uploadAsset).toHaveBeenCalledWith(expect.objectContaining({
      identifier: 'brand-frame',
      file: expect.any(File),
    }));
  });

  it('renames and deletes existing overlay assets', () => {
    const updateAsset = vi.fn();
    const deleteAsset = vi.fn();
    render(
      <OverlayAssetLibraryPanel
        assets={[{ id: 'overlay_1', identifier: 'old', width: 100, height: 80, sizeBytes: 1024, url: '/overlay.png' }]}
        deleteAsset={deleteAsset}
        updateAsset={updateAsset}
      />
    );

    fireEvent.change(screen.getByDisplayValue('old'), { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Deletar/i }));

    expect(updateAsset).toHaveBeenCalledWith('overlay_1', { identifier: 'new' });
    expect(deleteAsset).toHaveBeenCalledWith('overlay_1');
  });

  it('saves a Stories 9:16 profile for an overlay asset', () => {
    const updateAsset = vi.fn();
    render(
      <OverlayAssetLibraryPanel
        assets={[{ id: 'overlay_1', identifier: 'brand', width: 100, height: 80, sizeBytes: 1024, url: '/overlay.png' }]}
        updateAsset={updateAsset}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Stories/i }));
    expect(screen.getByRole('dialog', { name: /Ajustar overlay para Stories/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vertical' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Horizontal' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Horizontal' }));
    fireEvent.change(screen.getByLabelText(/Tamanho/i), { target: { value: '0.25' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Stories/i }));

    expect(updateAsset).toHaveBeenCalledWith('overlay_1', {
      storySettings: expect.objectContaining({ widthRatio: 0.25 }),
    });
  });

  it('keeps oversized Stories overlay placement inside the 9:16 frame', () => {
    const updateAsset = vi.fn();
    render(
      <OverlayAssetLibraryPanel
        assets={[{ id: 'overlay_1', identifier: 'brand', width: 100, height: 80, sizeBytes: 1024, url: '/overlay.png' }]}
        updateAsset={updateAsset}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Stories/i }));
    fireEvent.change(screen.getByLabelText(/Tamanho/i), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Stories/i }));

    expect(updateAsset).toHaveBeenCalledWith('overlay_1', {
      storySettings: expect.objectContaining({
        x: 0.5,
        y: 0.5,
        widthRatio: 1,
      }),
    });
  });
});
