import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesStatsPanel } from './SalesStatsPanel';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,qr-image')),
  },
}));

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

describe('SalesStatsPanel WhatsApp pairing', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).endsWith('/api/admin/whatsapp/status')) {
        return jsonResponse({
          ready: false,
          status: 'qr',
          lastError: null,
          hasQr: true,
          qr: 'pairing-payload',
        });
      }
      return jsonResponse({});
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the backend WhatsApp pairing QR inside the sales panel', async () => {
    render(<SalesStatsPanel {...baseProps} />);

    const qr = await screen.findByAltText('QR Code para parear WhatsApp');
    expect(qr).toHaveAttribute('src', 'data:image/png;base64,qr-image');
    expect(screen.getByText('QR DISPONÍVEL')).toBeInTheDocument();
    expect(screen.getByText(/Aparelhos conectados/i)).toBeInTheDocument();
  });
});
