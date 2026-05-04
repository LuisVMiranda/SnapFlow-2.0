import { ShareCountdown } from '../components/ShareCountdown';
import { SessionOpsCard } from '../components/SessionOpsCard';
import { formatMoney } from '../lib/formatters';
import { DEFAULT_PRICING } from '../lib/pricing';
import { buildShareWhatsAppMessage } from '../lib/share';

export function SummaryScreen({
  activeStage,
  clientPhone,
  count,
  handleCreateShareSession,
  handleExtendShareSession,
  handleGeneratePix,
  handleManualPayment,
  handleRevokeShareSession,
  isGeneratingPix,
  liveOps,
  noticeBanner,
  pricingOptions = DEFAULT_PRICING,
  resetSession,
  selectedPhotoItems,
  setClientPhone,
  setScreen,
  setShareDurationMinutes,
  shareAccess,
  shareActionLoading,
  shareDurationMinutes,
  shareToken,
  total,
  type,
  unit,
}) {
  const activePackage = pricingOptions[type] || pricingOptions[Object.keys(pricingOptions)[0]];

  return (
    <div className="screen center-screen">
      <header className="topbar">
        <button className="back-btn" onClick={() => setScreen('gallery')}>
          Voltar
        </button>
        <span className="topbar-title">Cobrança final</span>
        <span />
      </header>

      <SessionOpsCard
        title="Sessão atual"
        stage={activeStage}
        count={count}
        total={total}
        phone={clientPhone}
        packageType={type}
        pricingOptions={pricingOptions}
        paymentMethod={liveOps.paymentMethod}
        paymentStatus={liveOps.paymentStatus}
        deliveryStatus={liveOps.deliveryStatus}
        deliveryError={liveOps.deliveryError}
      />

      <div className="summary-card">
        <div className="summary-row">
          <span>Pacote escolhido</span>
          <strong>{activePackage.label}</strong>
        </div>
        <div className="summary-row">
          <span>Fotos a enviar</span>
          <strong>{count} fotos originais</strong>
        </div>
        <div className="summary-row">
          <span>Preço unitário</span>
          <strong>{formatMoney(unit)}</strong>
        </div>
        <div className="summary-divider" />
        <div className="summary-row total-row">
          <span>Total</span>
          <strong className="total-big">{formatMoney(total)}</strong>
        </div>
      </div>

      <div className="summary-card" style={{ marginTop: '16px' }}>
        <div className="summary-label">WhatsApp do cliente</div>
        <input
          type="tel"
          placeholder="(11) 99999-9999"
          value={clientPhone}
          onChange={(event) => setClientPhone(event.target.value.replace(/\D/g, ''))}
          className="phone-input"
        />
        <small className="summary-help">
          Assim que o pagamento for confirmado por você no painel, as imagens serão disparadas para ele em formato de documento, sem compressão.
        </small>
      </div>

      <div className="action-stack">
        <button
          className="btn-primary"
          disabled={isGeneratingPix || clientPhone.length < 10}
          onClick={handleGeneratePix}
        >
          {isGeneratingPix ? 'Conectando ao banco...' : 'Gerar QR Code'}
        </button>
        <button
          className="btn-manual btn-manual-cash"
          disabled={isGeneratingPix || clientPhone.length < 10}
          onClick={() => handleManualPayment('manual')}
        >
          {shareToken ? 'Solicitar Pagto em Dinheiro/Cartão' : 'Pagamento Dinheiro/Cartão'}
        </button>

        {!shareToken ? (
          <button
            className="btn-outline-white"
            style={{
              margin: '8px 0 0 0',
              width: '100%',
              borderColor: 'rgba(255, 68, 68, 0.5)',
              color: '#ff9999',
            }}
            onClick={() => {
              if (confirm('Deseja realmente cancelar esta venda? O cliente não receberá as fotos.')) {
                resetSession();
                setScreen('dashboard');
              }
            }}
          >
            Cancelar Venda
          </button>
        ) : null}
      </div>

      {!shareToken ? (
        <div className="summary-card" style={{ marginTop: '16px' }}>
          <div className="summary-label">Teste de link compartilhado</div>
          <small className="summary-help">
            Digite o WhatsApp do cliente, crie o link temporário e ele recebe automaticamente a mensagem com o código de 4 caracteres.
          </small>
          <div style={{ marginTop: '12px' }}>
            <label className="share-duration-label" htmlFor="share-duration">
              Tempo de acesso em minutos
            </label>
            <input
              id="share-duration"
              type="number"
              min="5"
              max="180"
              step="5"
              value={shareDurationMinutes}
              onChange={(event) =>
                setShareDurationMinutes(
                  Math.min(180, Math.max(5, Number(event.target.value) || 30))
                )
              }
              className="phone-input"
              style={{ marginTop: '6px' }}
            />
          </div>
          <div className="action-stack" style={{ padding: '14px 0 0' }}>
            <button
              className="btn-manual btn-manual-cash"
              disabled={shareActionLoading || selectedPhotoItems.length === 0}
              onClick={handleCreateShareSession}
            >
              {shareActionLoading ? 'Gerando e enviando...' : 'Criar link e enviar WhatsApp'}
            </button>
          </div>

          {shareAccess ? (
            <div className="share-summary">
              <div className="summary-row">
                <span>Link</span>
                <strong className="share-link-text">{shareAccess.link}</strong>
              </div>
              <div className="summary-row">
                <span>Código</span>
                <strong>{shareAccess.code}</strong>
              </div>
              <div className="summary-row">
                <span>Expira em</span>
                <strong>
                  <ShareCountdown isoDate={shareAccess.expiresAt} />
                </strong>
              </div>
              <div className="share-actions">
                <button
                  className="btn-manual btn-manual-card"
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      shareAccess.whatsappMessage ||
                        buildShareWhatsAppMessage(shareAccess.link, shareAccess.code)
                    )
                  }
                >
                  Copiar mensagem WhatsApp
                </button>
                <button
                  className="btn-manual btn-manual-card"
                  onClick={handleExtendShareSession}
                  disabled={shareActionLoading}
                >
                  Estender +15 min
                </button>
                <button
                  className="btn-manual btn-manual-cash"
                  onClick={handleRevokeShareSession}
                  disabled={shareActionLoading}
                >
                  Revogar acesso
                </button>
              </div>
              <small className="summary-help" style={{ marginTop: '12px' }}>
                {shareAccess.whatsappMessage ||
                  buildShareWhatsAppMessage(shareAccess.link, shareAccess.code)}
              </small>
            </div>
          ) : null}
        </div>
      ) : null}

      {noticeBanner}
    </div>
  );
}
