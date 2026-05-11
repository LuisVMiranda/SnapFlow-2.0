import { formatMoney } from '../lib/formatters';
import { DEFAULT_PRICING, DELIVERY_META, PAYMENT_META, packageLabel } from '../lib/pricing';

export function SessionOpsCard({
  title,
  stage,
  count,
  subtotal = 0,
  discountAmount = 0,
  total,
  showPricingBreakdown = true,
  clientName,
  phone,
  packageType,
  pricingOptions = DEFAULT_PRICING,
  paymentMethod,
  paymentStatus,
  deliveryStatus,
  deliveryError,
  manualPaymentNotice = 'Aguardando sua confirmação no painel para liberar o envio automático das fotos.',
  onRetryDelivery,
}) {
  const paymentMeta =
    paymentStatus === 'cancelled'
      ? PAYMENT_META.cancelled
      : paymentMethod === 'Dinheiro/Cartão' && paymentStatus === 'pending'
      ? { label: 'Aguardando aprovação', tone: 'info' }
      : PAYMENT_META[paymentStatus] || PAYMENT_META.draft;
  const deliveryMeta = DELIVERY_META[deliveryStatus] || DELIVERY_META.idle;
  const activePackageLabel = packageLabel(packageType, pricingOptions, 'Não definido');
  const paymentMethodLabel = paymentMethod || 'Não definido';
  const showManualPaymentNotice =
    paymentMethod === 'Dinheiro/Cartão' &&
    paymentStatus !== 'approved' &&
    manualPaymentNotice;
  const hasManualDiscount = showPricingBreakdown && Number(discountAmount || 0) > 0;

  return (
    <div className="ops-card">
      <div className="ops-header">
        <div>
          <strong>{title}</strong>
          <small>{stage}</small>
          {hasManualDiscount ? <small>{`Subtotal ${formatMoney(subtotal)} • Desconto ${formatMoney(discountAmount)}`}</small> : null}
        </div>
        <span className="ops-total">{formatMoney(total)}</span>
      </div>

      <div className="ops-grid">
        <div className="ops-stat">
          <span>Fotos</span>
          <strong>{count}</strong>
        </div>
        <div className="ops-stat">
          <span>Cliente</span>
          <strong>{clientName || 'Não informado'}</strong>
          {phone ? <small>{phone}</small> : null}
        </div>
        <div className="ops-stat">
          <span>Pacote ativo</span>
          <strong>{activePackageLabel}</strong>
        </div>
        <div className="ops-stat">
          <span>Forma de pagamento</span>
          <strong>{paymentMethodLabel}</strong>
        </div>
      </div>

      <div className="ops-badges">
        <span className={`ops-badge ${paymentMeta.tone}`}>{paymentMeta.label}</span>
        <span className={`ops-badge ${deliveryMeta.tone}`}>{deliveryMeta.label}</span>
      </div>

      {showManualPaymentNotice ? (
        <div className="ops-warning">
          {manualPaymentNotice}
        </div>
      ) : null}

      {deliveryError ? (
        <div className="ops-error">
          <span>{deliveryError}</span>
          {onRetryDelivery ? (
            <button className="share-quick-btn approve-session-btn" type="button" onClick={onRetryDelivery}>
              Reenviar fotos
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
