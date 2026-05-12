import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DashboardScreen } from './DashboardScreen';

const baseProps = {
  activeStage: 'Pronto para iniciar',
  adminAccessError: '',
  adminAccessStatus: 'idle',
  adminAttemptsRemaining: 5,
  adminHeaders: vi.fn(() => ({})),
  adminJsonHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
  adminRemember: false,
  cleanupPreview: null,
  clientPhone: '',
  count: 0,
  credentialsData: { api: [], profile: [] },
  credentialsStatus: 'idle',
  dashData: {
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
    shareRecent: [],
  },
  deleteCredential: vi.fn(),
  fetchDashboard: vi.fn(),
  handleFileUpload: vi.fn(),
  hasActiveSession: false,
  isAdminUnlocked: false,
  isUploading: false,
  liveOps: {
    paymentStatus: 'draft',
    deliveryStatus: 'idle',
    deliveryError: null,
    paymentMethod: null,
  },
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
  noticeBanner: null,
  notificationCenter: null,
  packageSettingsStatus: 'idle',
  period: 'hoje',
  pricingOptions: {
    eventos: {
      label: 'Pacote 5+ fotos',
      shortLabel: 'Eventos',
      description: 'R$ 15 por foto.',
      unit: 15,
      bulk: 10,
      threshold: 5,
    },
  },
  previewCleanup: vi.fn(),
  retentionSettings: {
    defaultGalleryRetentionDays: 30,
    deliveredPhotoRetentionDays: 30,
    expiredShareRetentionDays: 7,
    archiveBeforeDelete: false,
    autoCleanupEnabled: false,
  },
  runCleanup: vi.fn(),
  saveCredential: vi.fn(),
  savePackageSettings: vi.fn(),
  saveRetentionSettings: vi.fn(),
  saveWatermarkSettings: vi.fn(),
  saveWhatsAppTemplates: vi.fn(),
  setNotice: vi.fn(),
  setPeriod: vi.fn(),
  setRetentionSettings: vi.fn(),
  setType: vi.fn(),
  startNewSession: vi.fn(),
  total: 0,
  type: 'eventos',
  whatsAppTemplateStatus: 'idle',
  whatsAppTemplates: {
    shareLink: { body: 'Link {link}' },
    paymentWaiting: { body: 'Pagamento {linkText}' },
    deliveryThanks: { body: 'Obrigado {count}' },
  },
  watermarkSettings: {
    width: 420,
    height: 140,
    opacity: 0.55,
    instances: 1,
  },
  watermarkSettingsStatus: 'idle',
};

describe('DashboardScreen admin unlock', () => {
  it('hides editing controls until the admin token is verified', () => {
    render(<DashboardScreen {...baseProps} adminAccessStatus="denied" />);

    expect(screen.queryByRole('button', { name: /Galerias/i })).not.toBeInTheDocument();
    expect(screen.getByText('Painel protegido')).toBeInTheDocument();
  });

  it('shows the four compact sections after verified admin access', async () => {
    const user = userEvent.setup();
    render(
      <DashboardScreen
        {...baseProps}
        adminAccessStatus="granted"
        isAdminUnlocked
      />
    );

    expect(screen.getByRole('button', { name: /Galerias/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vendas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configurações/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Credenciais/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escolher fotos da câmera / galeria' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Configurações/i }));
    expect(screen.getByRole('button', { name: /Retenção e sanitização/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Pacotes e preços/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Marca d'água das prévias/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Mensagens do WhatsApp/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Editar pacotes/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pacotes e preços/i }));
    expect(screen.getByRole('button', { name: /Pacotes e preços/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Editar pacotes/i })).toBeInTheDocument();
  });

  it('renders the notification center next to the account menu when provided', () => {
    render(
      <DashboardScreen
        {...baseProps}
        adminAccessStatus="granted"
        isAdminUnlocked
        notificationCenter={<button type="button">Notificações</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument();
  });
});
