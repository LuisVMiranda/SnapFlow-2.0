import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';

const WHATSAPP_STATUS_LABELS = {
  ready: 'PRONTO',
  qr: 'QR DISPONÍVEL',
  initializing: 'CONECTANDO',
  failed: 'FALHA',
  disconnected: 'DESCONECTADO',
  unavailable: 'INDISPONÍVEL',
  verifying: 'VERIFICANDO',
};
const STATUS_POLL_INTERVAL_MS = 5000;
const READY_STATUS_POLL_INTERVAL_MS = 15000;
const STATUS_FAILURE_NOTICE_THRESHOLD = 3;
const TRANSIENT_API_STATUS = new Set([502, 503, 504]);

function whatsappStatusLabel(status) {
  return WHATSAPP_STATUS_LABELS[status] || String(status || 'verificando').toUpperCase();
}

function unavailableStatus(current, message) {
  return {
    ...(current || {}),
    ready: false,
    status: 'unavailable',
    lastError: message,
    hasQr: false,
    qr: null,
  };
}

function verifyingStatus(current) {
  if (!current?.ready) return current;
  return {
    ...current,
    ready: false,
    status: 'verifying',
    lastError: 'Servidor reiniciando ou temporariamente indisponível. Tentando novamente.',
  };
}

function whatsappStatusDescription(status) {
  if (status?.ready) return 'Pronto para enviar fotos.';
  return status?.lastError || 'Aguardando status do cliente controlado pelo backend.';
}

function WhatsAppQrPanel({ image }) {
  if (!image) return null;
  return (
    <div className="whatsapp-qr-panel" aria-label="QR Code de pareamento do WhatsApp">
      <img src={image} alt="QR Code para parear WhatsApp" />
      <small>Escaneie em WhatsApp &gt; Aparelhos conectados. Esta imagem vem do backend ativo.</small>
    </div>
  );
}

export function WhatsAppStatusCard({ adminHeaders, setNotice }) {
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);
  const [whatsAppQrImage, setWhatsAppQrImage] = useState('');
  const statusFailureCount = useRef(0);
  const statusFailureAnnounced = useRef(false);
  const statusRequestRunning = useRef(false);

  const recordStatusSuccess = useCallback((data) => {
    const recoveredAfterNotice = statusFailureAnnounced.current;
    statusFailureCount.current = 0;
    statusFailureAnnounced.current = false;
    setWhatsAppStatus(data);
    if (recoveredAfterNotice) setNotice('Conexão com o servidor restabelecida. Status do WhatsApp atualizado.');
  }, [setNotice]);

  const recordStatusFailure = useCallback((message, { announceImmediately = false, transient = true } = {}) => {
    statusFailureCount.current = transient
      ? statusFailureCount.current + 1
      : STATUS_FAILURE_NOTICE_THRESHOLD;
    const sustainedFailure = statusFailureCount.current >= STATUS_FAILURE_NOTICE_THRESHOLD;
    if (sustainedFailure) {
      setWhatsAppStatus((current) => unavailableStatus(current, 'Servidor temporariamente indisponível. Tentando reconectar automaticamente.'));
    } else {
      setWhatsAppStatus(verifyingStatus);
    }
    if (!announceImmediately && !sustainedFailure) return;
    if (statusFailureAnnounced.current && !announceImmediately) return;
    statusFailureAnnounced.current = true;
    setNotice(message);
  }, [setNotice]);

  const loadWhatsAppStatus = useCallback(async ({ announceImmediately = false } = {}) => {
    if (statusRequestRunning.current) return;
    statusRequestRunning.current = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/status`, {
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (response.ok) {
        recordStatusSuccess(data);
        return;
      }
      recordStatusFailure(
        buildApiErrorMessage('Não foi possível consultar o WhatsApp de envio.', response, data),
        { announceImmediately, transient: TRANSIENT_API_STATUS.has(response.status) }
      );
    } catch (error) {
      recordStatusFailure(
        buildNetworkErrorMessage('Não foi possível consultar o WhatsApp de envio.', error),
        { announceImmediately }
      );
    } finally {
      statusRequestRunning.current = false;
    }
  }, [adminHeaders, recordStatusFailure, recordStatusSuccess]);

  const reconnectWhatsApp = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/reconnect`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (response.ok) recordStatusSuccess(data);
      setNotice(response.ok
        ? data.ready
          ? 'WhatsApp pareado e pronto para envio.'
          : `Reconexão iniciada. ${data.lastError || 'Escaneie o QR Code no painel quando aparecer.'}`
        : buildApiErrorMessage('Não foi possível reconectar o WhatsApp.', response, data));
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível reconectar o WhatsApp.', error));
    }
  };

  const resetWhatsAppAuth = async () => {
    if (!window.confirm('Parear novamente o WhatsApp inicia uma sessão local nova e exige escanear um novo QR Code no painel. Continuar')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/reset-auth`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (response.ok) recordStatusSuccess(data);
      setNotice(response.ok
        ? 'Sessão local nova iniciada. Escaneie o QR Code no painel quando aparecer.'
        : buildApiErrorMessage('Não foi possível refazer o pareamento do WhatsApp.', response, data));
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível refazer o pareamento do WhatsApp.', error));
    }
  };

  useEffect(() => {
    loadWhatsAppStatus().catch(() => {});
  }, [loadWhatsAppStatus]);

  useEffect(() => {
    const intervalMs = whatsAppStatus?.ready ? READY_STATUS_POLL_INTERVAL_MS : STATUS_POLL_INTERVAL_MS;
    const timer = window.setInterval(() => {
      loadWhatsAppStatus().catch(() => {});
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [loadWhatsAppStatus, whatsAppStatus?.ready]);

  useEffect(() => {
    if (!whatsAppStatus?.qr) {
      setWhatsAppQrImage('');
      return undefined;
    }
    let active = true;
    QRCode.toDataURL(whatsAppStatus.qr, { margin: 1, width: 220 })
      .then((image) => {
        if (active) setWhatsAppQrImage(image);
      })
      .catch(() => {
        if (active) setWhatsAppQrImage('');
      });
    return () => {
      active = false;
    };
  }, [whatsAppStatus?.qr]);

  return (
    <div className="whatsapp-status-card">
      <div className="whatsapp-status-copy">
        <div className="whatsapp-status-heading">
          <strong>WhatsApp de envio</strong>
          <small>{whatsappStatusDescription(whatsAppStatus)}</small>
        </div>
        <WhatsAppQrPanel image={whatsAppQrImage} />
      </div>
      <div className="whatsapp-status-actions">
        <span className={`badge badge-${whatsAppStatus?.ready ? 'success' : 'danger'}`}>
          {whatsappStatusLabel(whatsAppStatus?.status)}
        </span>
        <button className="share-quick-btn" type="button" onClick={() => loadWhatsAppStatus({ announceImmediately: true })}>
          Atualizar
        </button>
        <button className="share-quick-btn approve-session-btn" type="button" onClick={reconnectWhatsApp}>
          Reconectar WhatsApp
        </button>
        <button className="share-quick-btn share-quick-btn-danger" type="button" onClick={resetWhatsAppAuth}>
          Parear novamente
        </button>
      </div>
    </div>
  );
}
