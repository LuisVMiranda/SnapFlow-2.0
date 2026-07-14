const path = require('path');
const fs = require('fs/promises');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { normalizeClientPhone, validateClientPhone } = require('./phone');

const AUTH_REMOVE_MAX_RETRIES = 10;
const PROFILE_LOCK_CODES = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM']);
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

function errorContext(error) {
  return [errorMessage(error), error?.code, error?.path, error?.stack]
    .filter(Boolean)
    .join('\n');
}

function profileLockCode(error) {
  const directCode = String(error?.code || '').toUpperCase();
  if (PROFILE_LOCK_CODES.has(directCode)) return directCode;
  const match = (errorMessage(error) || '').match(/\b(EBUSY|ENOTEMPTY|EPERM)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function isLocalAuthContext(error) {
  const context = errorContext(error).toLowerCase();
  return context.includes('.wwebjs_auth')
    || context.includes('localauth.logout')
    || context.includes('authstrategies\\localauth')
    || context.includes('authstrategies/localauth');
}

function isProfileLockedError(error) {
  const message = (errorMessage(error) || '').toLowerCase();
  const browserProfileLocked = message.includes('browser is already running')
    || message.includes('use a different `userdatadir`');
  return browserProfileLocked
    || (PROFILE_LOCK_CODES.has(profileLockCode(error)) && isLocalAuthContext(error));
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
      handler(friendlyError, error);
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
  clientFactory = null,
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
  let profileRecovery = null;
  let closed = false;
  const unsubscribeFromProcessFailures = subscribeToWhatsAppProcessFailures((error, originalError) => {
    handleRecoverableFailure(error, {
      consoleMessage: `WhatsApp perdeu o contexto interno e sera reconectado: ${error.message}`,
      destroyBeforeRetry: true,
      rotateProfileBeforeRetry: isProfileLockedError(originalError),
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

  async function rotateClientIdForRecovery() {
    if (profileRecovery) return profileRecovery;
    profileRecovery = (async () => {
      await ensureClientIdLoaded();
      return rotateClientId();
    })();
    try {
      return await profileRecovery;
    } finally {
      profileRecovery = null;
    }
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

  async function recoverClient({ destroyBeforeRetry = false, rotateProfileBeforeRetry = false } = {}) {
    if (closed) return;
    if (rotateProfileBeforeRetry) clearRetryTimer();
    if (destroyBeforeRetry) await destroyClient();
    if (closed) return;
    if (rotateProfileBeforeRetry) {
      const previousClientId = await rotateClientIdForRecovery();
      console.warn(`Perfil WhatsApp ${previousClientId} isolado após bloqueio do Windows. Novo perfil: ${activeClientId}.`);
    }
    scheduleReconnect();
  }

  function handleRecoverableFailure(error, options = {}) {
    ready = false;
    latestQr = null;
    lastError = friendlyWhatsAppError(error);
    status = options.nextStatus || 'failed';
    if (options.consoleMessage) console.warn(options.consoleMessage);
    recoverClient(options).catch((recoveryError) => {
      lastError = friendlyWhatsAppError(recoveryError);
      console.warn(`Falha ao preparar a reconexão do WhatsApp: ${lastError.message}`);
      scheduleReconnect();
    });
  }

  function makeClient() {
    const authOptions = activeClientId
      ? { dataPath: authDataPath, clientId: activeClientId }
      : { dataPath: authDataPath };
    const instance = clientFactory
      ? clientFactory({ authOptions, rmMaxRetries: AUTH_REMOVE_MAX_RETRIES })
      : new Client({
        authStrategy: new LocalAuth({ ...authOptions, rmMaxRetries: AUTH_REMOVE_MAX_RETRIES }),
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
      const loggedOut = reason === 'LOGOUT';
      handleRecoverableFailure(new Error(`WhatsApp desconectado: ${reason || 'motivo não informado'}`), {
        destroyBeforeRetry: loggedOut,
        nextStatus: loggedOut ? 'logged_out' : 'disconnected',
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
    if (closed || retryTimer) return;
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

  async function initializeClientAttempt(profileRotationsRemaining) {
    client = makeClient();
    try {
      await client.initialize();
      return { completed: true, profileRotationsRemaining, result: getStatus() };
    } catch (error) {
      ready = false;
      latestQr = null;
      await destroyClient();
      if (isProfileLockedError(error) && profileRotationsRemaining > 0) {
        const previousClientId = await rotateClientId();
        status = 'profile_locked';
        lastError = friendlyWhatsAppError(error);
        console.warn(`Perfil WhatsApp ${previousClientId} está bloqueado por Chromium. Tentando novo perfil ${activeClientId}.`);
        return { completed: false, profileRotationsRemaining: profileRotationsRemaining - 1 };
      }
      lastError = friendlyWhatsAppError(error);
      status = 'failed';
      if (isTransientWhatsAppError(error) || isProfileLockedError(error)) scheduleReconnect();
      throw lastError;
    }
  }

  async function initializeWithProfileRotation() {
    let profileRotationsRemaining = 2;
    while (true) {
      const attempt = await initializeClientAttempt(profileRotationsRemaining);
      if (attempt.completed) return attempt.result;
      profileRotationsRemaining = attempt.profileRotationsRemaining;
    }
  }

  async function initialize({ force = false } = {}) {
    if (closed) throw new Error('Cliente WhatsApp encerrado. Reinicie o backend para iniciar uma nova sessão.');
    if (ready && !force) return getStatus();
    if (initializing) return initializing;
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
      try {
        return await initializeWithProfileRotation();
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
      const validation = validateClientPhone(phone);
      if (!validation.valid) throw new Error(validation.message);
      const number = message ? await sendText(phone, message) : validation.normalized;
      const contactId = await client.getNumberId(number);
      if (!contactId) throw new Error(`Número não encontrado no WhatsApp: ${validation.formatted}.`);
      for (const photo of photos) {
        const media = MessageMedia.fromFilePath(path.join(storageRoot, photo.originalPath));
        await client.sendMessage(contactId._serialized, media, { sendMediaAsDocument: true });
      }
    });
  }

  async function shutdown() {
    closed = true;
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
  isWhatsAppRecoverableProcessError,
  isTransientWhatsAppError,
  normalizeClientPhone,
  validateClientPhone,
};
