import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ShareLockScreen } from './ShareLockScreen';

describe('ShareLockScreen', () => {
  it('renders a loading-safe shell before shared metadata arrives', () => {
    render(
      <ShareLockScreen
        shareSessionInfo={null}
        shareCodeInput=""
        setShareCodeInput={vi.fn()}
        handleUnlockSharedSession={vi.fn()}
        shareActionLoading={false}
        noticeBanner={null}
      />
    );

    expect(screen.getByText('SnapFlow compartilhado')).toBeInTheDocument();
    expect(screen.getByText('---')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir galeria' })).toBeEnabled();
  });

  it('normalizes access codes before updating state and calls unlock', async () => {
    const handleUnlockSharedSession = vi.fn();
    const setShareCodeInput = vi.fn();

    render(
      <ShareLockScreen
        shareSessionInfo={{
          photoCount: 3,
          expiresAt: '2026-05-02T12:00:00.000Z',
          status: 'active',
          galleryName: 'Ensaio da Sofia',
          galleryDescription: 'Seleção final para a família.',
          discountAmount: 40,
        }}
        shareCodeInput=""
        setShareCodeInput={setShareCodeInput}
        handleUnlockSharedSession={handleUnlockSharedSession}
        shareActionLoading={false}
        noticeBanner={null}
      />
    );

    expect(screen.getByText('Ensaio da Sofia')).toBeInTheDocument();
    expect(screen.getByText('Seleção final para a família.')).toBeInTheDocument();
    expect(screen.queryByText(/Desconto do fotógrafo/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Código de 4 caracteres'), {
      target: { value: 'ab-12' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Abrir galeria' }));

    expect(setShareCodeInput).toHaveBeenLastCalledWith('AB12');
    expect(handleUnlockSharedSession).toHaveBeenCalledTimes(1);
  });
});
