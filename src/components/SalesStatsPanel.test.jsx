import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesStatsPanel } from './SalesStatsPanel';

const baseDashData = {
  stats: {
    hoje: { valor: 0, fotos: 0, sessoes: 0 },
    semana: { valor: 0, fotos: 0, sessoes: 0 },
    mes: { valor: 0, fotos: 0, sessoes: 0 },
    ano: { valor: 0, fotos: 0, sessoes: 0 },
  },
  chartSeries: {
    diario: [],
    semanal: [],
    mensal: [],
    anual: [],
  },
  recent: [],
};

const baseProps = {
  activeStage: 'Pronto',
  adminHeaders: vi.fn(() => ({ Authorization: 'Bearer admin-secret' })),
  clientPhone: '',
  count: 0,
  dashData: baseDashData,
  fetchDashboard: vi.fn(),
  hasActiveSession: false,
  liveOps: {
    paymentMethod: null,
    paymentStatus: 'draft',
    deliveryStatus: 'idle',
    deliveryError: null,
  },
  period: 'hoje',
  pricingOptions: {
    eventos: {
      label: 'Eventos',
      shortLabel: 'Eventos',
      unit: 10,
      bulk: 8,
      threshold: 5,
    },
  },
  sessionId: '',
  setNotice: vi.fn(),
  setPeriod: vi.fn(),
  total: 0,
  type: 'eventos',
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('SalesStatsPanel manual release cancellation', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).endsWith('/api/admin/whatsapp/status')) {
        return jsonResponse({ ready: true, status: 'ready', lastError: null });
      }
      if (String(url).endsWith('/api/admin/sessions/manual_1/cancel-release')) {
        return jsonResponse({
          success: true,
          session: {
            id: 'manual_1',
            status: 'cancelled',
            deliveryStatus: 'cancelled',
          },
        });
      }
      return jsonResponse({});
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows approval and cancellation actions for pending cash/card sessions', async () => {
    const user = userEvent.setup();
    const fetchDashboard = vi.fn();
    const setNotice = vi.fn();
    render(
      <SalesStatsPanel
        {...baseProps}
        dashData={{
          ...baseDashData,
          recent: [{
            id: 'manual_1',
            amount: 40,
            photoCount: 4,
            packageType: 'eventos',
            status: 'pending',
            paymentMethod: 'Dinheiro/Cartão',
            deliveryStatus: 'idle',
          }],
        }}
        fetchDashboard={fetchDashboard}
        setNotice={setNotice}
      />
    );

    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Liberar fotos' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar liberação' }));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/sessions/manual_1/cancel-release',
      expect.objectContaining({ method: 'POST' })
    );
    expect(setNotice).toHaveBeenCalledWith('Liberação cancelada. Esta venda não poderá mais ser aprovada por esse pedido.');
    expect(fetchDashboard).toHaveBeenCalledWith({ silent: true });
  });

  it('does not render approval actions for cancelled sessions', () => {
    render(
      <SalesStatsPanel
        {...baseProps}
        dashData={{
          ...baseDashData,
          recent: [{
            id: 'manual_1',
            amount: 40,
            photoCount: 4,
            packageType: 'eventos',
            status: 'cancelled',
            paymentMethod: 'Dinheiro/Cartão',
            deliveryStatus: 'cancelled',
          }],
        }}
      />
    );

    expect(screen.getByText('Liberação cancelada')).toBeInTheDocument();
    expect(screen.getByText('Envio cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Liberar fotos' })).not.toBeInTheDocument();
  });
});
