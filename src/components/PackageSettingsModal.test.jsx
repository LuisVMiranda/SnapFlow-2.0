import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PackageSettingsModal } from './PackageSettingsModal';

describe('PackageSettingsModal', () => {
  it('lets admins add a package before saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => true);

    render(
      <PackageSettingsModal
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        pricingOptions={{
          eventos: {
            label: 'Pacote 5+ fotos',
            shortLabel: 'Eventos',
            description: 'Teste',
            unit: 15,
            bulk: 10,
            threshold: 5,
          },
        }}
        status="idle"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Adicionar pacote' }));
    await user.click(screen.getByRole('button', { name: 'Salvar pacotes' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      eventos: expect.any(Object),
      pacote_2: expect.objectContaining({ label: 'Novo pacote' }),
    }));
  });
});
