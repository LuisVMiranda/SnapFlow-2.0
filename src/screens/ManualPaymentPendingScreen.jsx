import { SessionOpsCard } from '../components/SessionOpsCard';
import { formatMoney } from '../lib/formatters';
import { DEFAULT_PRICING } from '../lib/pricing';

function approvalUrl(sessionId) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/?adminApproval=${encodeURIComponent(sessionId || '')}`;
}

export function ManualPaymentPendingScreen({
  activeStage,
  clientName,
  clientPhone,
  count,
  liveOps,
  noticeBanner,
  pricingOptions = DEFAULT_PRICING,
  sessionId,
  setScreen,
  shareToken = '',
  total,
  type,
}) {
  const isClientFlow = Boolean(shareToken);
  const pendingTitle = isClientFlow ? 'Pedido recebido' : 'Aprovação manual';
  const opsTitle = isClientFlow ? 'Pedido aguardando aprovação' : 'Venda aguardando liberação';
  const opsStage = isClientFlow ? 'Aguardando aprovação do fotógrafo' : activeStage;
  const manualPaymentNotice = isClientFlow
    ? 'Pedido enviado ao fotógrafo. Assim que o pagamento for aprovado, o envio das fotos será liberado automaticamente.'
    : 'Aguardando sua confirmação no painel para liberar o envio automático das fotos.';
  const statusLabel = isClientFlow ? 'Aguardando aprovação do fotógrafo' : 'Aguardando aprovação';
  const helpText = isClientFlow
    ? 'Seu pedido foi enviado. Mantenha esta aba aberta para acompanhar a liberação; a tela será atualizada quando o pagamento for aprovado.'
    : 'A venda fica aberta aqui enquanto o painel aprova a liberação. Use a nova aba para aprovar sem perder a seleção atual.';

  const openApproval = () => {
    if (!sessionId || typeof window === 'undefined') return;
    window.open(approvalUrl(sessionId), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="screen center-screen">
      <header className="topbar">
        <button className="back-btn" type="button" onClick={() => setScreen('summary')}>
          Voltar
        </button>
        <span className="topbar-title">{pendingTitle}</span>
        <span />
      </header>

      <SessionOpsCard
        title={opsTitle}
        stage={opsStage}
        count={count}
        total={total}
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

      <section className="summary-card pending-manual-card">
        <div className="summary-label">{isClientFlow ? 'Pagamento solicitado' : 'Pagamento em dinheiro/cartão'}</div>
        <div className="summary-row">
          <span>Fotos selecionadas</span>
          <strong>{count}</strong>
        </div>
        <div className="summary-row">
          <span>Total</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <div className="summary-row">
          <span>Cliente</span>
          <strong>{clientName || 'Não informado'}</strong>
        </div>
        <div className="summary-row">
          <span>WhatsApp</span>
          <strong>{clientPhone || 'Não informado'}</strong>
        </div>
        <div className="summary-row">
          <span>Status</span>
          <strong>{statusLabel}</strong>
        </div>
        <small className="summary-help">
          {helpText}
        </small>
      </section>

      <div className="action-stack">
        {isClientFlow ? (
          <button className="btn-manual btn-manual-card" type="button" onClick={() => setScreen('gallery')}>
            Voltar para a galeria
          </button>
        ) : (
          <>
            <button className="btn-primary" type="button" onClick={openApproval} disabled={!sessionId}>
              Abrir aprovação no painel
            </button>
            <button className="btn-manual btn-manual-card" type="button" onClick={() => setScreen('summary')}>
              Continuar nesta venda
            </button>
          </>
        )}
      </div>

      {noticeBanner}
    </div>
  );
}
