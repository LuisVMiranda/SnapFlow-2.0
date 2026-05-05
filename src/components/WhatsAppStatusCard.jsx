import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { API_BASE_URL, buildApiErrorMessage, readJsonResponse } from '../lib/apiClient';

const WHATSAPP_STATUS_LABELS = {
  ready: 'PRONTO',
  qr: 'QR DISPONÍVEL',
  initializing: 'CONECTANDO',
  failed: 'FALHA',
  disconnected: 'DESCONECTADO',
  unavailable: 'INDISPONÍVEL',
  verifying: 'VERIFICANDO',
};

function whatsappStatusLabel(status) {
  return WHATSAPP_STATUS_LABELS[status] || String(status || 'verificando').toUpperCase();
}

export function WhatsAppStatusCard({ adminHeaders, setNotice }) {
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);
  const [whatsAppQrImage, setWhatsAppQrImage] = useState('');

  const loadWhatsAppStatus = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/status`, {
      headers: adminHeaders(),
    });
    const data = await readJsonResponse(response);
    if (response.ok) setWhatsAppStatus(data);
  }, [adminHeaders]);

  const reconnectWhatsApp = async () => {
    const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/reconnect`, {
      method: 'POST',
      headers: adminHeaders(),
    });
    const data = await readJsonResponse(response);
    setWhatsAppStatus(data);
    setNotice(data.ready
      ? 'WhatsApp pareado e pronto para envio.'
      : `Reconexão iniciada. ${data.lastError || 'Escaneie o QR Code no painel quando aparecer.'}`);
  };

  const resetWhatsAppAuth = async () => {
    if (!window.confirm('Parear novamente o WhatsApp inicia uma sessão local nova e exige escanear um novo QR Code no painel. Continuar?')) return;
    const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/reset-auth`, {
      method: 'POST',
      headers: adminHeaders(),
    });
    const data = await readJsonResponse(response);
    setWhatsAppStatus(data);
    setNotice(response.ok
      ? 'Sessão local nova iniciada. Escaneie o QR Code no painel quando aparecer.'
      : buildApiErrorMessage('Não foi possível refazer o pareamento do WhatsApp.', response, data));
  };

  useEffect(() => {
    loadWhatsAppStatus().catch(() => {});
  }, [loadWhatsAppStatus]);

  useEffect(() => {
    if (!whatsAppStatus || whatsAppStatus.ready) return undefined;
    const timer = window.setInterval(() => {
      loadWhatsAppStatus().catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadWhatsAppStatus, whatsAppStatus]);

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
          <small>
            {whatsAppStatus?.ready
              ? 'Pronto para enviar fotos.'
              : whatsAppStatus?.lastError || 'Aguardando status do cliente controlado pelo backend.'}
          </small>
        </div>
        {whatsAppQrImage ? (
          <div className="whatsapp-qr-panel" aria-label="QR Code de pareamento do WhatsApp">
            <img src={whatsAppQrImage} alt="QR Code para parear WhatsApp" />
            <small>Escaneie em WhatsApp &gt; Aparelhos conectados. Esta imagem vem do backend ativo.</small>
          </div>
        ) : null}
      </div>
      <div className="whatsapp-status-actions">
        <span className={`badge badge-${whatsAppStatus?.ready ? 'success' : 'danger'}`}>
          {whatsappStatusLabel(whatsAppStatus?.status)}
        </span>
        <button className="share-quick-btn" type="button" onClick={loadWhatsAppStatus}>
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
