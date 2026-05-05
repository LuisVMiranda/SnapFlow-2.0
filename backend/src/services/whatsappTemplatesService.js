const { HttpError } = require('../errors');

const DEFAULT_WHATSAPP_TEMPLATES = {
  shareLink: {
    label: 'Link da galeria',
    description: 'Mensagem usada ao criar ou recriar um link de galeria.',
    body: [
      'Olá {name}! Seu link SnapFlow foi liberado.',
      '{linkLabel}: {link}',
      'Código: {code}',
      'Expira em até {expiresMinutes} minuto(s).',
      'Abra pelo navegador e selecione suas fotos.',
    ].join('\n'),
  },
  paymentWaiting: {
    label: 'Aguardando pagamento',
    description: 'Mensagem de apoio para pedidos que ainda aguardam confirmação de pagamento.',
    body: [
      'Recebemos sua seleção no SnapFlow, {name}.',
      'Assim que o pagamento for confirmado, suas fotos serão liberadas.',
      '{linkLabel}: {link}',
    ].join('\n'),
  },
  deliveryThanks: {
    label: 'Agradecimento e envio',
    description: 'Mensagem enviada antes dos arquivos finais na fila do WhatsApp.',
    body: 'Obrigado, {name}! Aqui estão suas fotos profissionais em qualidade máxima.',
  },
};

const TEMPLATE_KEYS = Object.keys(DEFAULT_WHATSAPP_TEMPLATES);
const MAX_TEMPLATE_LENGTH = 1200;
const LEGACY_DEFAULT_TEMPLATE_BODIES = {
  shareLink: [
    'Olá! Seu link SnapFlow foi liberado.',
    '{linkLabel}: {link}',
    'Código: {code}',
    'Expira em até {expiresMinutes} minuto(s).',
    'Abra pelo navegador e selecione suas fotos.',
  ].join('\n'),
  paymentWaiting: [
    'Recebemos sua seleção no SnapFlow.',
    'Assim que o pagamento for confirmado, suas fotos serão liberadas.',
    '{linkLabel}: {link}',
  ].join('\n'),
  deliveryThanks: 'Obrigado pela compra! Aqui estão suas fotos profissionais em qualidade máxima.',
};

function parseSetting(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeTemplateBody(value, fallback) {
  const body = String(value || fallback || '').trim();
  return body.slice(0, MAX_TEMPLATE_LENGTH);
}

function normalizeStoredTemplateBody(key, value, fallback) {
  const body = normalizeTemplateBody(value, fallback);
  return body === LEGACY_DEFAULT_TEMPLATE_BODIES[key] ? fallback : body;
}

function normalizeTemplates(value) {
  const source = parseSetting(value);
  return Object.fromEntries(
    TEMPLATE_KEYS.map((key) => {
      const defaults = DEFAULT_WHATSAPP_TEMPLATES[key];
      return [
        key,
        {
          ...defaults,
          body: normalizeStoredTemplateBody(key, source[key]?.body ?? source[key], defaults.body),
        },
      ];
    })
  );
}

function renderTemplate(template, variables = {}) {
  return String(template || '').replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key] ?? '');
    }
    return match;
  });
}

function linkVariables({ link = '', linkLabel = 'Abrir galeria' } = {}) {
  return {
    link,
    linkLabel,
    linkText: `${linkLabel}: ${link}`.trim(),
  };
}

function createWhatsAppTemplatesService({ repos }) {
  async function getSettings() {
    const raw = await repos.getSettings();
    return normalizeTemplates(raw.whatsAppTemplates);
  }

  async function updateSettings(templates) {
    const normalized = normalizeTemplates(templates);
    for (const key of TEMPLATE_KEYS) {
      if (!normalized[key].body) {
        throw new HttpError(400, `Informe a mensagem "${DEFAULT_WHATSAPP_TEMPLATES[key].label}".`, 'whatsapp_template_required');
      }
    }
    await repos.upsertSettings({ whatsAppTemplates: normalized });
    return getSettings();
  }

  async function render(key, variables = {}) {
    const templates = await getSettings();
    const template = templates[key];
    if (!template) throw new HttpError(404, 'Modelo de WhatsApp não encontrado.', 'whatsapp_template_not_found');
    const normalizedVariables = {
      ...variables,
      name: variables.name || variables.clientName || 'cliente',
      clientName: variables.clientName || variables.name || '',
    };
    return renderTemplate(template.body, {
      linkLabel: 'Abrir galeria',
      ...normalizedVariables,
    });
  }

  async function renderShareLinkMessage({
    link,
    accessCode,
    expiresMinutes,
    linkLabel = 'Abrir galeria',
    ...variables
  }) {
    return render('shareLink', {
      ...linkVariables({ link, linkLabel }),
      ...variables,
      code: accessCode,
      expiresMinutes,
    });
  }

  async function renderPaymentWaitingMessage(variables = {}) {
    return render('paymentWaiting', {
      ...linkVariables(variables),
      ...variables,
    });
  }

  async function renderDeliveryThanksMessage(variables = {}) {
    return render('deliveryThanks', {
      ...linkVariables(variables),
      ...variables,
    });
  }

  return {
    getSettings,
    render,
    renderDeliveryThanksMessage,
    renderPaymentWaitingMessage,
    renderShareLinkMessage,
    updateSettings,
  };
}

module.exports = {
  DEFAULT_WHATSAPP_TEMPLATES,
  createWhatsAppTemplatesService,
  normalizeTemplates,
  renderTemplate,
};
