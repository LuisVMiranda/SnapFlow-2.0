const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createWhatsAppTemplatesService,
  normalizeTemplates,
  renderTemplate,
} = require('../src/services/whatsappTemplatesService');

function createMemoryRepos(initialSettings = {}) {
  let settings = { ...initialSettings };
  return {
    async getSettings() {
      return settings;
    },
    async upsertSettings(nextSettings) {
      settings = { ...settings, ...nextSettings };
      return settings;
    },
  };
}

test('WhatsApp template renderer replaces known variables and preserves unknown ones', () => {
  const rendered = renderTemplate('Olá {name}, acesse {link}. Código {missing}', {
    link: 'https://snap.test/s/abc',
    name: 'Ana',
  });

  assert.equal(rendered, 'Olá Ana, acesse https://snap.test/s/abc. Código {missing}');
});

test('WhatsApp template settings merge saved bodies with safe defaults', () => {
  const templates = normalizeTemplates({
    shareLink: { body: 'Galeria: {link}' },
  });

  assert.equal(templates.shareLink.body, 'Galeria: {link}');
  assert.match(templates.paymentWaiting.body, /pagamento/i);
  assert.match(templates.deliveryThanks.body, /Obrigado/i);
});

test('WhatsApp template service saves and renders editable admin messages', async () => {
  const service = createWhatsAppTemplatesService({
    repos: createMemoryRepos(),
  });

  await service.updateSettings({
    shareLink: { body: 'Abra {linkLabel}: {link}\nCódigo {code}' },
    paymentWaiting: { body: 'Pagamento pendente para {count} foto(s). {linkText}' },
    deliveryThanks: { body: 'Obrigado pela compra de {count} foto(s)!' },
  });

  const shareMessage = await service.renderShareLinkMessage({
    accessCode: 'AB12',
    expiresMinutes: 30,
    link: 'https://snap.test/s/abc',
    linkLabel: 'Clique aqui',
  });
  const paymentMessage = await service.renderPaymentWaitingMessage({
    count: 2,
    link: 'https://snap.test/s/abc',
    linkLabel: 'Ver pedido',
  });
  const deliveryMessage = await service.renderDeliveryThanksMessage({ count: 2 });

  assert.equal(shareMessage, 'Abra Clique aqui: https://snap.test/s/abc\nCódigo AB12');
  assert.equal(paymentMessage, 'Pagamento pendente para 2 foto(s). Ver pedido: https://snap.test/s/abc');
  assert.equal(deliveryMessage, 'Obrigado pela compra de 2 foto(s)!');
});
