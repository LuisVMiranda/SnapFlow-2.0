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
});
