import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WatermarkAssetLibraryPanel } from './WatermarkAssetLibraryPanel';

describe('WatermarkAssetLibraryPanel', () => {
  it("uploads and lists reusable watermark assets", async () => {
    const user = userEvent.setup();
    const uploadAsset = vi.fn(async () => ({ id: 'asset_1' }));

    render(
      <WatermarkAssetLibraryPanel
        assets={[{
          id: 'asset_1',
          name: 'Brand X',
          url: '/api/admin/watermark-assets/asset_1/file?admin_token=admin',
          width: 120,
          height: 80,
          sizeBytes: 4096,
        }]}
        deleteAsset={vi.fn()}
        updateAsset={vi.fn()}
        uploadAsset={uploadAsset}
      />
    );

    await user.type(screen.getByLabelText('Nome'), 'Brand X');
    await user.upload(
      screen.getByLabelText('Imagem'),
      new File(['fake'], 'brand.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: "Enviar marca d'água" }));

    expect(uploadAsset).toHaveBeenCalledWith({
      file: expect.any(File),
      name: 'Brand X',
    });
    expect(screen.getByDisplayValue('Brand X')).toBeInTheDocument();
    expect(screen.getByText('120x80px - 4 KB')).toBeInTheDocument();
  });
});
