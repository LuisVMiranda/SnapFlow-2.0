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
  it('masks sensitive values and saves multiple changes after one confirmation', async () => {
    const user = userEvent.setup();
    const saveCredentialsBatch = vi.fn(async () => ({
      ok: true,
      results: {
        mpAccessToken: { status: 'saved' },
        photographerName: { status: 'saved' },
      },
    }));

    render(
      <CredentialsPanel
        credentialsData={credentialsData}
        credentialsStatus="idle"
        deleteCredential={vi.fn()}
        saveCredential={vi.fn()}
        saveCredentialsBatch={saveCredentialsBatch}
      />
    );

    expect(screen.getByText('••••1234')).toBeInTheDocument();
    expect(screen.queryByText('secret-live-token-1234')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Novo valor', { selector: 'input[type="password"]' }), 'secret-live-token-1234');
    const nameInput = screen.getByLabelText('Novo valor', { selector: 'input[type="text"]' });
    await user.clear(nameInput);
    await user.type(nameInput, 'Ana Souza');
    expect(screen.getAllByRole('button', { name: /Salvar alterações/i })).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: /Salvar alterações/i })[0]);

    expect(screen.getByRole('dialog', { name: 'Confirmar alteração' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Senha administrativa'), 'admin123');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(saveCredentialsBatch).toHaveBeenCalledWith({
      confirmation: 'admin123',
      changes: [
        { key: 'mpAccessToken', label: 'Token de acesso Mercado Pago', value: 'secret-live-token-1234' },
        { key: 'photographerName', label: 'Nome do fotógrafo', value: 'Ana Souza' },
      ],
    });
  });
});
