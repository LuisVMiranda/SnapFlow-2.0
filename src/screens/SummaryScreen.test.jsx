import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SummaryScreen } from './SummaryScreen';

const baseProps = {
  activeStage: 'Conferindo valor',
  clientPhone: '11999999999',
  count: 2,
  handleCreateShareSession: vi.fn(),
  handleExtendShareSession: vi.fn(),
  handleGeneratePix: vi.fn(),
  handleManualPayment: vi.fn(),
  handleRevokeShareSession: vi.fn(),
  isGeneratingPix: false,
  liveOps: {
    paymentStatus: 'draft',
    deliveryStatus: 'idle',
    deliveryError: null,
    paymentMethod: null,
  },
  noticeBanner: null,
  resetSession: vi.fn(),
  selectedPhotoItems: [{ id: 'p1' }, { id: 'p2' }],
  setClientPhone: vi.fn(),
  setScreen: vi.fn(),
  setShareDurationMinutes: vi.fn(),
  shareAccess: null,
  shareActionLoading: false,
  shareDurationMinutes: 30,
  shareToken: '',
  total: 30,
  type: 'eventos',
  unit: 15,
};

describe('SummaryScreen', () => {
  it('fires Pix and manual payment actions from the checkout buttons', async () => {
    const props = { ...baseProps, handleGeneratePix: vi.fn(), handleManualPayment: vi.fn() };
    render(<SummaryScreen {...props} />);

    await userEvent.click(screen.getByRole('button', { name: 'Gerar QR Code' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pagamento Dinheiro/Cartão' }));

    expect(props.handleGeneratePix).toHaveBeenCalledTimes(1);
    expect(props.handleManualPayment).toHaveBeenCalledWith('manual');
  });
});
