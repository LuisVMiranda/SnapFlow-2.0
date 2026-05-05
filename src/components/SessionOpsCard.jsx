import { formatMoney } from '../lib/formatters';
import { DEFAULT_PRICING, DELIVERY_META, PAYMENT_META, packageLabel } from '../lib/pricing';

export function SessionOpsCard({
  title,
  stage,
  count,
  total,
  clientName,
  phone,
  packageType,
  pricingOptions = DEFAULT_PRICING,
  paymentMethod,
  paymentStatus,
  deliveryStatus,
  deliveryError,
  onRetryDelivery,
}) {
  const paymentMeta = PAYMENT_META[paymentStatus] || PAYMENT_META.draft;
  const deliveryMeta = DELIVERY_META[deliveryStatus] || DELIVERY_META.idle;
  const activePackageLabel = packageLabel(packageType, pricingOptions, 'Não definido');
  const paymentMethodLabel = paymentMethod || 'Não definido';

  return (
    <div className="ops-card">
      <div className="ops-header">
        <div>
          <strong>{title}</strong>
          <small>{stage}</small>
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

      {paymentMethod === 'Dinheiro/Cartão' ? (
        <div className="ops-warning">
          Aguardando sua confirmação no painel para liberar o envio automático das fotos.
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
