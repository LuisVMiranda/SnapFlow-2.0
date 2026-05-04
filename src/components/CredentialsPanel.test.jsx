import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CredentialsPanel } from './CredentialsPanel';

const credentialsData = {
  api: [
    {
      key: 'mpAccessToken',
      label: 'Token de acesso Mercado Pago',
      group: 'api',
      sensitive: true,
      configured: true,
      maskedValue: '••••1234',
      source: 'database',
      updatedAt: '2026-05-02T12:00:00.000Z',
    },
  ],
  profile: [
    {
      key: 'photographerName',
      label: 'Nome do fotógrafo',
      group: 'profile',
      sensitive: false,
      configured: true,
      maskedValue: 'Ana Silva',
      source: 'database',
      updatedAt: null,
    },
  ],
};

describe('CredentialsPanel', () => {
  it('masks sensitive values and requires confirmation before saving', async () => {
    const user = userEvent.setup();
    const saveCredential = vi.fn(async () => true);

    render(
      <CredentialsPanel
        credentialsData={credentialsData}
        credentialsStatus="idle"
        deleteCredential={vi.fn()}
        saveCredential={saveCredential}
      />
    );

    expect(screen.getByText('••••1234')).toBeInTheDocument();
    expect(screen.queryByText('secret-live-token-1234')).not.toBeInTheDocument();

    const tokenInput = screen.getByLabelText('Novo valor', { selector: 'input[type="password"]' });
    await user.type(tokenInput, 'secret-live-token-1234');
    await user.click(screen.getAllByRole('button', { name: /Salvar/i })[0]);

    expect(screen.getByRole('dialog', { name: 'Confirmar alteração' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Senha administrativa'), 'admin123');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(saveCredential).toHaveBeenCalledWith({
      key: 'mpAccessToken',
      value: 'secret-live-token-1234',
      confirmation: 'admin123',
    });
  });
});
