import { SessionOpsCard } from '../components/SessionOpsCard';
import { formatMoney } from '../lib/formatters';

export function PixScreen({
  activeStage,
  clientName,
  clientPhone,
  count,
  liveOps,
  noticeBanner,
  pricingOptions,
  pixCopyPaste,
  pixWhatsAppMessage,
  qrCodeBase64,
  setNotice,
  setPixCopyPaste,
  setQrCodeBase64,
  setScreen,
  shareToken,
  total,
  type,
}) {
  return (
    <div className="screen center-screen">
      <header className="topbar">
        <button className="back-btn" onClick={() => setScreen('summary')}>
          Voltar
        </button>
        <span className="topbar-title">Pagamento Pix real</span>
        <span />
      </header>

      <SessionOpsCard
        title="Sessão atual"
        stage={activeStage}
        count={count}
        total={total}
        clientName={clientName}
        phone={clientPhone}
        packageType={type}
        pricingOptions={pricingOptions}
        paymentStatus={liveOps.paymentStatus}
        deliveryStatus={liveOps.deliveryStatus}
        deliveryError={liveOps.deliveryError}
      />

      <div className="qr-box">
        <div className="qr-code-area">
          {qrCodeBase64 ? (
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              style={{ width: '200px', height: '200px' }}
              alt="QR Code Pix"
            />
          ) : (
            <div className="qr-fake">
              <span className="spinner">...</span>
            </div>
          )}
        </div>
        <div className="pix-total">{formatMoney(total)}</div>
        <div className="pix-sub">{count} foto(s) selecionadas</div>

        {pixCopyPaste ? (
          <div style={{ width: '100%', marginTop: '16px' }}>
            <button
              className="btn-manual btn-manual-card"
              style={{ width: '100%', fontSize: '14px', padding: '12px' }}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pixCopyPaste);
                  setNotice('Código PIX copiado. Cole no app do banco.');
                } catch {
                  setNotice('Erro ao copiar. Tente novamente.');
                }
              }}
            >
              Copiar código PIX (Copia e Cola)
            </button>
            <small className="pix-copy-help">
              Use este código se não conseguir escanear o QR Code
            </small>
          </div>
        ) : null}
      </div>

      <div className="pix-status">
        <span className="spinner">...</span> Processando pelo aplicativo do banco...
      </div>

      {pixWhatsAppMessage && !shareToken ? (
        <div className="summary-card pix-whatsapp-message-card">
          <div className="summary-label">Mensagem WhatsApp de cobrança</div>
          <small className="summary-help">
            Texto gerado pelas configurações atuais para avisar o cliente enquanto o Pix está pendente.
          </small>
          <pre className="whatsapp-message-preview">{pixWhatsAppMessage}</pre>
          <button
            className="btn-manual btn-manual-card"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(pixWhatsAppMessage);
                setNotice('Mensagem de cobrança copiada.');
              } catch {
                setNotice('Não foi possível copiar a mensagem.');
              }
            }}
          >
            Copiar mensagem
          </button>
        </div>
      ) : null}

      {!shareToken ? (
        <div style={{ padding: '0 16px', marginTop: '16px' }}>
          <button
            className="btn-outline-white"
            style={{
              width: '100%',
              borderColor: 'rgba(255, 68, 68, 0.5)',
              color: '#ff9999',
              margin: 0,
            }}
            onClick={() => {
              if (confirm('Deseja realmente cancelar este pagamento? O cliente terá que gerar um novo QR Code.')) {
                setQrCodeBase64('');
                setPixCopyPaste('');
                setScreen('summary');
              }
            }}
          >
            Cancelar pagamento
          </button>
        </div>
      ) : null}

      {noticeBanner}
    </div>
  );
}
