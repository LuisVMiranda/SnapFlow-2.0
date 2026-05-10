import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccountMenu } from './AccountMenu';

describe('AccountMenu', () => {
  it('submits credentials only from the modal form', async () => {
    const loginAdmin = vi.fn(async () => true);
    render(
      <AccountMenu
        adminAccessError=""
        adminAccessStatus="idle"
        adminAttemptsRemaining={5}
        adminRemember={false}
        isAdminUnlocked={false}
        loginAdmin={loginAdmin}
        logoutAdmin={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abrir conta administrativa' }));
    await userEvent.type(screen.getByLabelText('Credencial'), 'admin123');
    await userEvent.click(screen.getByLabelText('Manter login neste dispositivo'));
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(loginAdmin).toHaveBeenCalledWith({ token: 'admin123', remember: true });
  });

  it('offers logout when admin access is active', async () => {
    const logoutAdmin = vi.fn();
    render(
      <AccountMenu
        adminAccessError=""
        adminAccessStatus="granted"
        adminAttemptsRemaining={5}
        adminRemember
        isAdminUnlocked
        loginAdmin={vi.fn()}
        logoutAdmin={logoutAdmin}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abrir conta administrativa' }));
    await userEvent.click(screen.getByRole('button', { name: /Sair/ }));

    expect(logoutAdmin).toHaveBeenCalledTimes(1);
  });

  it('explains temporary lockout with the automatic release time', async () => {
    render(
      <AccountMenu
        adminAccessError=""
        adminAccessStatus="locked"
        adminAttemptsRemaining={0}
        adminLockedUntil="2026-05-10T14:30:00.000Z"
        adminRemember={false}
        adminRetryAfterSeconds={1800}
        isAdminUnlocked={false}
        loginAdmin={vi.fn()}
        logoutAdmin={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abrir conta administrativa' }));

    expect(screen.getByText(/Limite de tentativas atingido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });
});
