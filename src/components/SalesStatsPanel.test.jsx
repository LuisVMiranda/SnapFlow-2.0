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
  conversionFunnel: [],
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

  it('renders a readable daily breakdown table under the chart', () => {
    render(
      <SalesStatsPanel
        {...baseProps}
        dashData={{
          ...baseDashData,
          stats: {
            ...baseDashData.stats,
            hoje: { valor: 80, fotos: 8, sessoes: 2 },
          },
          chartSeries: {
            ...baseDashData.chartSeries,
            diario: [
              { label: '10/05', valor: 50, sessoes: 1, fotos: 6 },
              { label: '11/05', valor: 30, sessoes: 1, fotos: 2 },
            ],
          },
        }}
      />
    );

    expect(screen.getByText('Detalhamento por dia')).toBeInTheDocument();
    expect(screen.getAllByText(/data em que o pagamento foi aprovado/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('11/05').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 30,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 50,00').length).toBeGreaterThan(0);
  });

  it('renders the conversion funnel when analytics are available', () => {
    render(
      <SalesStatsPanel
        {...baseProps}
        dashData={{
          ...baseDashData,
          conversionFunnel: [
            { type: 'share_opened', label: 'Links abertos', count: 5 },
            { type: 'pix_generated', label: 'Pix gerados', count: 2 },
          ],
        }}
      />
    );

    expect(screen.getByText('Funil de conversão de hoje')).toBeInTheDocument();
    expect(screen.getByText('Links abertos')).toBeInTheDocument();
    expect(screen.getByText('Pix gerados')).toBeInTheDocument();
  });

  it('shows and retries WhatsApp notice independently from original media', async () => {
    const user = userEvent.setup();
    render(
      <SalesStatsPanel
        {...baseProps}
        dashData={{
          ...baseDashData,
          recent: [{
            id: 'approved_1',
            amount: 40,
            photoCount: 4,
            packageType: 'eventos',
            status: 'approved',
            shareToken: 'share_1',
            deliveryStatus: 'failed',
            deliveryError: 'Falha nos documentos',
            notificationStatus: 'failed',
            notificationError: 'WhatsApp desconectado',
          }],
        }}
      />
    );

    expect(screen.getByText('Aviso falhou')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar fotos' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reenviar aviso' }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/sessions/approved_1/retry-notification',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
