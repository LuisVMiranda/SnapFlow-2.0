const path = require('path');
const fs = require('fs/promises');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { normalizeClientPhone, validateClientPhone } = require('./phone');

const RETRY_DELAYS_MS = [5000, 10000, 30000, 60000];
const transientWhatsAppNeedles = [
  'Execution context was destroyed',
  'Protocol error',
  'Target closed',
  'Session closed',
  'Navigation failed',
  'Cannot find context',
  'Attempted to use detached Frame',
  'detached Frame',
  'Frame was detached',
  'Navigating frame was detached',
  'Target page, context or browser has been closed',
];

let processGuardInstalled = false;
const processFailureHandlers = new Set();

function isTransientWhatsAppError(error) {
  const message = errorMessage(error) || '';
  return transientWhatsAppNeedles.some((needle) => message.includes(needle));
}

function errorMessage(error) {
  if (!error) return null;
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  const fallback = String(error || '').trim();
  return fallback || null;
}

function isProfileLockedError(error) {
  const message = errorMessage(error) || '';
  return message.includes('browser is already running') || message.includes('Use a different `userDataDir`');
}

function friendlyWhatsAppError(error) {
  if (isProfileLockedError(error)) {
    return new Error(
      'O perfil local do WhatsApp ficou preso por um processo Chromium anterior. O SnapFlow vai trocar automaticamente para um novo perfil; se persistir, feche processos antigos de node/chrome ou reinicie o computador.'
    );
  }
  const message = errorMessage(error) || '';
  if (message.includes('detached Frame')) {
    return new Error(
      'WhatsApp Web saiu, recarregou ou perdeu a janela controlada pelo backend. A API continua ativa e o SnapFlow vai tentar reconectar; se aparecer QR Code em Vendas > WhatsApp de envio, escaneie novamente.'
    );
  }
  if (!isTransientWhatsAppError(error)) return error instanceof Error ? error : new Error(message || 'Falha no WhatsApp.');
  return new Error(
    'WhatsApp Web recarregou ou perdeu o contexto controlado pelo backend. O SnapFlow vai tentar reconectar automaticamente; se persistir, use Reconectar WhatsApp no painel e escaneie o QR Code em Vendas.'
  );
}

function isWhatsAppRecoverableProcessError(error) {
  const stack = error && error.stack ? String(error.stack) : '';
  const stackLooksWhatsApp = stack.includes('whatsapp-web.js') || stack.includes('puppeteer-core');
  return stackLooksWhatsApp && (isTransientWhatsAppError(error) || isProfileLockedError(error));
}

function installWhatsAppProcessGuard() {
  if (processGuardInstalled) return;
  processGuardInstalled = true;

  const handleFailure = (error) => {
    if (!isWhatsAppRecoverableProcessError(error)) throw error;
    const friendlyError = friendlyWhatsAppError(error);
    console.warn(`Falha recuperavel do WhatsApp interceptada: ${friendlyError.message}`);
    for (const handler of processFailureHandlers) {
      handler(friendlyError);
    }
  };

  process.on('uncaughtException', handleFailure);
  process.on('unhandledRejection', handleFailure);
}

function subscribeToWhatsAppProcessFailures(handler) {
  installWhatsAppProcessGuard();
  processFailureHandlers.add(handler);
  return () => processFailureHandlers.delete(handler);
}

function validClientId(value) {
  return /^[A-Za-z0-9_-]+$/.test(String(value || ''));
}

function freshClientId() {
  return `snapflow2-${Date.now()}`;
}

async function readClientId(filePath) {
  try {
    const value = (await fs.readFile(filePath, 'utf8')).trim();
    return validClientId(value) ? value : null;
  } catch {
    return null;
  }
}

async function writeClientId(filePath, clientId) {
  await fs.writeFile(filePath, `${clientId}\n`, 'utf8');
}

function createWhatsAppClient({
  authDataPath = path.join(process.cwd(), '.wwebjs_auth'),
  cachePath = path.join(process.cwd(), '.wwebjs_cache'),
  clientIdPath = path.join(process.cwd(), '.wwebjs_client_id'),
} = {}) {
  let client = null;
  let activeClientId = null;
  let clientIdLoaded = false;
  let ready = false;
  let status = 'idle';
  let lastError = null;
  let initializing = null;
  let retryTimer = null;
  let retryAttempts = 0;
  let lastQrAt = null;
  let lastReadyAt = null;
  let latestQr = null;
  const unsubscribeFromProcessFailures = subscribeToWhatsAppProcessFailures((error) => {
    handleRecoverableFailure(error, {
      consoleMessage: `WhatsApp perdeu o contexto interno e sera reconectado: ${error.message}`,
      destroyBeforeRetry: true,
    });
  });

  function getStatus() {
    return {
      ready,
      status,
      retryAttempts,
      lastError: errorMessage(lastError),
      lastQrAt,
      lastReadyAt,
      hasQr: Boolean(latestQr && !ready),
      qr: ready ? null : latestQr,
      clientId: activeClientId || 'default',
    };
  }

  async function ensureClientIdLoaded() {
    if (clientIdLoaded) return;
    activeClientId = await readClientId(clientIdPath);
    clientIdLoaded = true;
  }

  async function rotateClientId() {
    const previousClientId = activeClientId || 'default';
    activeClientId = freshClientId();
    clientIdLoaded = true;
    await writeClientId(clientIdPath, activeClientId);
    lastQrAt = null;
    lastReadyAt = null;
    latestQr = null;
    return previousClientId;
  }

  function clearRetryTimer() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  async function destroyClient() {
    if (!client) return;
    const oldClient = client;
    client = null;
    try {
      await oldClient.pupBrowser.close();
    } catch {
      // Closing the underlying browser is best-effort; destroy below may still succeed.
    }
    try {
      await oldClient.destroy();
    } catch {
      // whatsapp-web.js can throw while tearing down an already-broken page.
    }
  }

  function handleRecoverableFailure(error, { consoleMessage, destroyBeforeRetry = false, nextStatus = 'failed' } = {}) {
    ready = false;
    latestQr = null;
    lastError = friendlyWhatsAppError(error);
    status = nextStatus;
    if (consoleMessage) console.warn(consoleMessage);
    const reconnect = () => scheduleReconnect();
    if (destroyBeforeRetry) {
      destroyClient().finally(reconnect);
      return;
    }
    reconnect();
  }

  function makeClient() {
    const authOptions = activeClientId
      ? { dataPath: authDataPath, clientId: activeClientId }
      : { dataPath: authDataPath };
    const instance = new Client({
      authStrategy: new LocalAuth(authOptions),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
        ],
      },
    });

    instance.on('qr', (qr) => {
      lastQrAt = new Date().toISOString();
      latestQr = qr;
      console.log('QR Code do WhatsApp gerado. Abra Vendas > WhatsApp de envio para escanear pelo painel.');
    });
    instance.on('authenticated', () => {
      status = 'authenticated';
    });
    instance.on('ready', () => {
      ready = true;
      status = 'ready';
      retryAttempts = 0;
      lastError = null;
      latestQr = null;
      lastReadyAt = new Date().toISOString();
      clearRetryTimer();
      console.log('Bot WhatsApp pareado e pronto para a fila.');
    });
    instance.on('disconnected', (reason) => {
      console.warn('WhatsApp desconectado:', reason);
      handleRecoverableFailure(new Error(`WhatsApp desconectado: ${reason || 'motivo não informado'}`), {
        nextStatus: reason === 'LOGOUT' ? 'logged_out' : 'disconnected',
      });
    });
    instance.on('auth_failure', (message) => {
      ready = false;
      status = 'auth_failure';
      latestQr = null;
      lastError = new Error(`Falha de autenticação do WhatsApp: ${message}. Abra Vendas > WhatsApp de envio, use Reparar se necessário e escaneie o QR Code novamente.`);
      console.warn('Falha de autenticação do WhatsApp:', message);
    });

    return instance;
  }

  function scheduleReconnect() {
    if (retryTimer) return;
    const delay = RETRY_DELAYS_MS[Math.min(retryAttempts, RETRY_DELAYS_MS.length - 1)];
    status = 'waiting_retry';
    retryAttempts += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      initialize({ force: true }).catch((error) => {
        console.warn(`Nova tentativa do WhatsApp falhou: ${error.message}`);
      });
    }, delay);
    retryTimer.unref?.();
  }

  async function initialize({ force = false } = {}) {
    if (ready && !force) return getStatus();
    if (initializing && !force) return initializing;
    if (force) {
      clearRetryTimer();
      ready = false;
      await destroyClient();
    }

    initializing = (async () => {
      ready = false;
      status = 'initializing';
      latestQr = null;
      await ensureClientIdLoaded();
      let profileRotationsRemaining = 2;
      try {
        while (true) {
          client = makeClient();
          try {
            await client.initialize();
            return getStatus();
          } catch (error) {
            ready = false;
            latestQr = null;
            await destroyClient();
            if (isProfileLockedError(error) && profileRotationsRemaining > 0) {
              const previousClientId = await rotateClientId();
              profileRotationsRemaining -= 1;
              status = 'profile_locked';
              lastError = friendlyWhatsAppError(error);
              console.warn(`Perfil WhatsApp ${previousClientId} está bloqueado por Chromium. Tentando novo perfil ${activeClientId}.`);
              continue;
            }
            lastError = friendlyWhatsAppError(error);
            status = 'failed';
            if (isTransientWhatsAppError(error) || isProfileLockedError(error)) scheduleReconnect();
            throw lastError;
          }
        }
      } finally {
        initializing = null;
      }
    })();

    return initializing;
  }

  async function reconnect() {
    return initialize({ force: true });
  }

  async function resetAuth() {
    clearRetryTimer();
    ready = false;
    status = 'resetting_auth';
    latestQr = null;
    await destroyClient();
    const previousClientId = await rotateClientId();
    lastError = null;
    retryAttempts = 0;
    initialize({ force: true }).catch((error) => {
      console.warn(`Inicialização após reset do WhatsApp falhou: ${error.message}`);
    });
    return { ...getStatus(), previousClientId, authDataPath, cachePath, clientIdPath };
  }

  function assertReady() {
    if (!ready || !client) {
      const lastErrorMessage = errorMessage(lastError);
      const detail = lastErrorMessage
        ? ` Último erro: ${lastErrorMessage}`
        : ' Abra Vendas > WhatsApp de envio para parear ou reconectar o WhatsApp.';
      throw new Error(`WhatsApp ainda não está pronto para envio.${detail}`);
    }
  }

  async function withWhatsAppOperation(operation) {
    assertReady();
    try {
      return await operation();
    } catch (error) {
      if (isTransientWhatsAppError(error)) {
        handleRecoverableFailure(error);
        throw lastError;
      }
      throw error;
    }
  }

  async function sendText(phone, message) {
    return withWhatsAppOperation(async () => {
      const validation = validateClientPhone(phone);
      if (!validation.valid) throw new Error(validation.message);
      const number = validation.normalized;
      const contactId = await client.getNumberId(number);
      if (!contactId) {
        throw new Error(`Número não encontrado no WhatsApp: ${validation.formatted}. Confira o DDI, o número local e se o cliente realmente usa WhatsApp neste contato.`);
      }
      await client.sendMessage(contactId._serialized, message);
      return number;
    });
  }

  async function sendPhotos(phone, photos, storageRoot, message = 'Obrigado por comprar conosco! Aqui estão suas fotos profissionais em qualidade máxima.') {
    return withWhatsAppOperation(async () => {
      const number = await sendText(phone, message);
      const contactId = await client.getNumberId(number);
      for (const photo of photos) {
        const media = MessageMedia.fromFilePath(path.join(storageRoot, photo.originalPath));
        await client.sendMessage(contactId._serialized, media, { sendMediaAsDocument: true });
      }
    });
  }

  async function shutdown() {
    clearRetryTimer();
    ready = false;
    status = 'closed';
    latestQr = null;
    unsubscribeFromProcessFailures();
    await destroyClient();
  }

  return { getStatus, initialize, reconnect, resetAuth, sendText, sendPhotos, shutdown };
}

module.exports = {
  createWhatsAppClient,
  friendlyWhatsAppError,
  isTransientWhatsAppError,
  normalizeClientPhone,
  validateClientPhone,
};
