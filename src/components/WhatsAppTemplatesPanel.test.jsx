import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WhatsAppTemplatesPanel } from './WhatsAppTemplatesPanel';

const templates = {
  shareLink: {
    label: 'Link da galeria',
    body: 'Abra {linkLabel}: {link}\nCódigo {code}',
  },
  paymentWaiting: {
    label: 'Aguardando pagamento',
    body: 'Aguardando pagamento. {linkText}',
  },
  paymentApproved: {
    label: 'Pagamento confirmado',
    body: 'Pago. Baixe até {expiresAt}. {linkText} Código {code}',
  },
  deliveryThanks: {
    label: 'Agradecimento e envio',
    body: 'Obrigado, {name}! Aqui estão suas {count} foto(s).',
  },
};

describe('WhatsAppTemplatesPanel', () => {
  it('renders editable templates and explains the WhatsApp link limitation', () => {
    render(
      <WhatsAppTemplatesPanel
        saveWhatsAppTemplates={vi.fn()}
        status="idle"
        templates={templates}
      />
    );

    expect(screen.getByText('Mensagens do WhatsApp')).toBeInTheDocument();
    expect(screen.getByLabelText('Link da galeria')).toHaveValue(templates.shareLink.body);
    expect(screen.getByLabelText('Aguardando pagamento')).toHaveValue(templates.paymentWaiting.body);
    expect(screen.getByLabelText('Pagamento confirmado')).toHaveValue(templates.paymentApproved.body);
    expect(screen.getByLabelText('Agradecimento e envio')).toHaveValue(templates.deliveryThanks.body);
    expect(screen.getByRole('button', { name: '{name}' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '{accessDays}' })).toBeInTheDocument();
    expect(screen.getByText(/a URL precisa aparecer para ficar clicável/i)).toBeInTheDocument();
  });

  it('shows layman tooltip context when tapping a placeholder pill', async () => {
    const user = userEvent.setup();

    render(
      <WhatsAppTemplatesPanel
        saveWhatsAppTemplates={vi.fn()}
        status="idle"
        templates={templates}
      />
    );

    await user.click(screen.getByRole('button', { name: '{linkText}' }));

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Combina rótulo e URL em uma frase pronta'
    );
  });

  it('explains the client name placeholder pill', async () => {
    const user = userEvent.setup();

    render(
      <WhatsAppTemplatesPanel
        saveWhatsAppTemplates={vi.fn()}
        status="idle"
        templates={templates}
      />
    );

    await user.click(screen.getByRole('button', { name: '{name}' }));

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Nome do cliente informado na criação ou edição da galeria'
    );
  });

  it('keeps the rightmost session ID tooltip available without page-width overflow', async () => {
    const user = userEvent.setup();

    render(
      <WhatsAppTemplatesPanel
        saveWhatsAppTemplates={vi.fn()}
        status="idle"
        templates={templates}
      />
    );

    await user.click(screen.getByRole('button', { name: '{sessionId}' }));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Identificador interno da venda');
    expect(tooltip.style.getPropertyValue('--tooltip-left')).toBeTruthy();
    expect(tooltip.style.getPropertyValue('--tooltip-top')).toBeTruthy();
  });

  it('sizes desktop template fields to the saved message instead of forcing inner scrollbars', () => {
    render(
      <WhatsAppTemplatesPanel
        saveWhatsAppTemplates={vi.fn()}
        status="idle"
        templates={{
          ...templates,
          shareLink: {
            body: [
              'Olá! Seu link SnapFlow foi liberado.',
              '{linkLabel}: {link}',
              'Código: {code}',
              'Expira em até {expiresMinutes} minuto(s).',
              'Abra pelo navegador e selecione suas fotos.',
            ].join('\n'),
          },
        }}
      />
    );

    expect(screen.getByLabelText('Link da galeria')).toHaveAttribute('rows', '6');
  });

  it('saves the edited WhatsApp template draft', async () => {
    const user = userEvent.setup();
    const saveWhatsAppTemplates = vi.fn(async () => true);

    render(
      <WhatsAppTemplatesPanel
        saveWhatsAppTemplates={saveWhatsAppTemplates}
        status="idle"
        templates={templates}
      />
    );

    fireEvent.change(screen.getByLabelText('Aguardando pagamento'), {
      target: { value: 'Pagamento pendente: {linkText}' },
    });
    await user.click(screen.getByRole('button', { name: 'Salvar mensagens' }));

    expect(saveWhatsAppTemplates).toHaveBeenCalledWith(expect.objectContaining({
      paymentWaiting: expect.objectContaining({
        body: 'Pagamento pendente: {linkText}',
      }),
    }));
  });
});
