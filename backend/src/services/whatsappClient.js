const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

function normalizeBrazilPhone(phone) {
  let number = String(phone || '').replace(/\D/g, '');
  if (number.length === 10 || number.length === 11) number = `55${number}`;
  return number;
}

function createWhatsAppClient() {
  let ready = false;
  let lastError = null;

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  client.on('qr', (qr) => {
    console.log('QR Code do WhatsApp gerado. Escaneie com seu celular:');
    qrcode.generate(qr, { small: true });
  });
  client.on('ready', () => {
    ready = true;
    lastError = null;
    console.log('Bot WhatsApp pareado e pronto para a fila.');
  });
  client.on('disconnected', (reason) => {
    ready = false;
    lastError = new Error(`WhatsApp desconectado: ${reason}`);
    console.warn('WhatsApp desconectado:', reason);
  });
  client.on('auth_failure', (message) => {
    ready = false;
    lastError = new Error(`Falha de autenticacao do WhatsApp: ${message}`);
    console.warn('Falha de autenticação do WhatsApp:', message);
  });

  async function initialize() {
    try {
      await client.initialize();
    } catch (error) {
      ready = false;
      lastError = error;
      if (String(error?.message || '').includes('Execution context was destroyed')) {
        throw new Error(
          'WhatsApp Web recarregou durante a inicialização. A API continua ativa; reinicie o backend ou aguarde uma nova tentativa quando o WhatsApp estabilizar.',
          { cause: error }
        );
      }
      throw error;
    }
  }

  function assertReady() {
    if (!ready) {
      const detail = lastError?.message ? ` Ultimo erro: ${lastError.message}` : '';
      throw new Error(`WhatsApp ainda não está pronto para envio.${detail}`);
    }
  }

  async function sendText(phone, message) {
    assertReady();
    const number = normalizeBrazilPhone(phone);
    if (!number || number.length < 10) throw new Error('Telefone inválido para envio.');
    const contactId = await client.getNumberId(number);
    if (!contactId) throw new Error('Número não encontrado no WhatsApp.');
    await client.sendMessage(contactId._serialized, message);
    return number;
  }

  async function sendPhotos(phone, photos, storageRoot, message = 'Obrigado por comprar conosco! Aqui estão suas fotos profissionais em qualidade máxima.') {
    assertReady();
    const number = await sendText(phone, message);
    const contactId = await client.getNumberId(number);
    for (const photo of photos) {
      const media = MessageMedia.fromFilePath(path.join(storageRoot, photo.originalPath));
      await client.sendMessage(contactId._serialized, media, { sendMediaAsDocument: true });
    }
  }

  function getStatus() {
    return { ready, lastError: lastError?.message || null };
  }

  return { getStatus, initialize, sendText, sendPhotos };
}

module.exports = { createWhatsAppClient, normalizeBrazilPhone };
