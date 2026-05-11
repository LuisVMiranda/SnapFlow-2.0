import { ShareCountdown } from '../components/ShareCountdown';
import { SessionOpsCard } from '../components/SessionOpsCard';
import { validateOptionalEmail } from '../lib/email';
import { formatMoney } from '../lib/formatters';
import { phoneDigits, validateBrazilPhone } from '../lib/phone';
import { DEFAULT_PRICING } from '../lib/pricing';
import { buildShareWhatsAppMessage } from '../lib/share';

export function SummaryScreen({
  activeStage,
  clientName,
  clientEmail,
  clientPhone,
  count,
  discountAmount = 0,
  discountEligible = true,
  discountThreshold = 0,
  discountValidation = { valid: true, message: '' },
  handleCreateShareSession,
  handleExtendShareSession,
  handleGeneratePix,
  handleManualPayment,
  handleRevokeShareSession,
  isGeneratingPix,
  liveOps,
  manualDiscountDraft = '',
  manualDiscountEnabled = false,
  noticeBanner,
  pricingOptions = DEFAULT_PRICING,
  resetSession,
  selectedPhotoItems,
  setClientName,
  setClientEmail,
  setClientPhone,
  setManualDiscountDraft = () => {},
  setManualDiscountEnabled = () => {},
  setScreen,
  setShareDurationMinutes,
  shareAccess,
  shareActionLoading,
  shareDurationMinutes,
  shareToken,
  subtotal = 0,
  total,
  type,
  unit,
}) {
  const activePackage = pricingOptions[type] || pricingOptions[Object.keys(pricingOptions)[0]];
  const phoneValidation = validateBrazilPhone(clientPhone);
  const emailValidation = validateOptionalEmail(clientEmail);
  const canSubmitPhone = phoneValidation.valid;
  const canUseDiscount = shareToken ? true : discountValidation.valid;
  const canGeneratePix = canSubmitPhone && emailValidation.valid && canUseDiscount;
  const shareMessage = shareAccess
    ? shareAccess.whatsappMessage || buildShareWhatsAppMessage(shareAccess.link, shareAccess.code)
    : '';
  const manualWhatsAppUrl = shareAccess && phoneValidation.valid
    ? `https://wa.me/${phoneValidation.normalized}?text=${encodeURIComponent(shareMessage)}`
    : '';
  const manualPaymentNotice = shareToken
    ? 'Pedido enviado ao fotógrafo. Assim que o pagamento for aprovado, o envio das fotos será liberado automaticamente.'
    : undefined;
  const hasManualDiscount = Number(discountAmount || 0) > 0;

  const confirmFreeOrder = () => {
    if (
      shareToken
      || !manualDiscountEnabled
      || !discountEligible
      || Number(discountAmount || 0) !== Number(subtotal || 0)
      || subtotal <= 0
    ) {
      return true;
    }
    return window.confirm('Este desconto deixa o pedido gratuito para o cliente. Deseja continuar mesmo assim?');
  };

  const runWithDiscountConfirmation = (action) => {
    if (!confirmFreeOrder()) return;
    action();
  };

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
        subtotal={subtotal}
        discountAmount={discountAmount}
        clientName={clientName}
        phone={clientPhone}
        packageType={type}
        pricingOptions={pricingOptions}
        paymentMethod={liveOps.paymentMethod}
        paymentStatus={liveOps.paymentStatus}
        deliveryStatus={liveOps.deliveryStatus}
        deliveryError={liveOps.deliveryError}
        manualPaymentNotice={manualPaymentNotice}
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
        {hasManualDiscount ? (
          <>
            <div className="summary-row">
              <span>Subtotal antes do desconto</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <div className="summary-row">
              <span>Desconto concedido pelo fotógrafo</span>
              <strong style={{ color: '#86efac' }}>- {formatMoney(discountAmount)}</strong>
            </div>
          </>
        ) : null}
        <div className="summary-divider" />
        <div className="summary-row total-row">
          <span>{hasManualDiscount ? 'Total final' : 'Total'}</span>
          <strong className="total-big">{formatMoney(total)}</strong>
        </div>
        {shareToken && hasManualDiscount ? (
          <small className="summary-help success">
            Este desconto foi concedido pelo fotógrafo para esta galeria.
          </small>
        ) : null}
      </div>

      {!shareToken ? (
        <div className="summary-card" style={{ marginTop: '16px' }}>
          <label className="summary-label" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={manualDiscountEnabled}
              onChange={(event) => {
                const nextEnabled = event.target.checked;
                setManualDiscountEnabled(nextEnabled);
                if (!nextEnabled) setManualDiscountDraft('');
              }}
            />
            Aplicar desconto manual nesta venda
          </label>

          {manualDiscountEnabled ? (
            <>
              <div className="summary-label summary-label-spaced">Valor do desconto em reais</div>
              <input
                type="number"
                min="0.01"
                max={subtotal}
                step="0.01"
                placeholder="Ex.: 10"
                value={manualDiscountDraft}
                onChange={(event) => setManualDiscountDraft(event.target.value)}
                className="phone-input"
              />
              <small className={`summary-help ${discountValidation.valid ? 'success' : 'danger'}`}>
                {!discountValidation.valid
                  ? discountValidation.message
                  : !discountEligible
                    ? `Este desconto só será aplicado quando o pacote atingir ${discountThreshold} foto(s). Até lá, o total segue ${formatMoney(subtotal)}.`
                    : `Subtotal atual: ${formatMoney(subtotal)}. Total final após desconto: ${formatMoney(total)}.`}
              </small>
            </>
          ) : (
            <small className="summary-help">
              Ative apenas quando quiser reduzir manualmente o valor cobrado deste cliente.
            </small>
          )}
        </div>
      ) : null}

      <div className="summary-card" style={{ marginTop: '16px' }}>
        <div className="summary-label">Cliente</div>
        <input
          type="text"
          placeholder="Nome de quem vai acessar e pagar"
          value={clientName}
          onChange={(event) => setClientName(event.target.value.replace(/\s+/g, ' ').slice(0, 80))}
          className="phone-input"
        />

        <div className="summary-label summary-label-spaced">E-mail do cliente</div>
        <input
          type="email"
          placeholder="cliente@exemplo.com"
          value={clientEmail}
          onChange={(event) => setClientEmail(event.target.value.slice(0, 120))}
          className="phone-input"
        />
        <small className={`summary-help ${emailValidation.tone}`}>
          {emailValidation.message}
        </small>

        <div className="summary-label summary-label-spaced">WhatsApp do cliente</div>
        <input
          type="tel"
          placeholder="(11) 99999-9999"
          value={clientPhone}
          onChange={(event) => setClientPhone(phoneDigits(event.target.value).slice(0, 13))}
          className="phone-input"
        />
        <small className={`summary-help ${phoneValidation.valid ? 'success' : 'danger'}`}>
          {phoneValidation.valid
            ? `Número validado para envio: ${phoneValidation.formatted}`
            : phoneValidation.message}
        </small>
        <small className="summary-help">
          {shareToken
            ? 'Assim que o pagamento for confirmado, suas fotos serão liberadas pelo fotógrafo.'
            : 'Assim que o pagamento for confirmado por você no painel, as imagens serão disparadas para ele em formato de documento, sem compressão.'}
        </small>
      </div>

      <div className="action-stack">
        <button
          className="btn-primary"
          disabled={isGeneratingPix || !canGeneratePix}
          onClick={() => runWithDiscountConfirmation(handleGeneratePix)}
        >
          {isGeneratingPix ? 'Conectando ao banco...' : 'Gerar QR Code'}
        </button>
        <button
          className="btn-manual btn-manual-cash"
          disabled={isGeneratingPix || !canSubmitPhone || !emailValidation.valid || !canUseDiscount}
          onClick={() => runWithDiscountConfirmation(() => handleManualPayment('manual'))}
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
              disabled={shareActionLoading || selectedPhotoItems.length === 0 || !canSubmitPhone || !emailValidation.valid || !canUseDiscount}
              onClick={() => runWithDiscountConfirmation(handleCreateShareSession)}
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
                  onClick={() => navigator.clipboard?.writeText(shareMessage)}
                >
                  Copiar mensagem WhatsApp
                </button>
                <button
                  className="btn-manual btn-manual-card"
                  onClick={() => window.open(manualWhatsAppUrl, '_blank', 'noopener,noreferrer')}
                  disabled={!manualWhatsAppUrl}
                >
                  Abrir WhatsApp manual
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
                {shareMessage}
              </small>
            </div>
          ) : null}
        </div>
      ) : null}

      {noticeBanner}
    </div>
  );
}
