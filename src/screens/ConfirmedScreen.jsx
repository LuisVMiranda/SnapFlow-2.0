import { SessionOpsCard } from '../components/SessionOpsCard';
import { DELIVERY_META } from '../lib/pricing';

export function ConfirmedScreen({
  activeStage,
  clientPhone,
  count,
  fetchDashboard,
  liveOps,
  noticeBanner,
  pricingOptions,
  resetSession,
  setScreen,
  shareToken,
  total,
  type,
}) {
  const deliveryMeta = DELIVERY_META[liveOps.deliveryStatus] || DELIVERY_META.idle;
  const isPix = liveOps.paymentMethod === 'PIX';

  return (
    <div className="screen confirmed-screen">
      <div className="confirmed-icon">✓</div>
      <h1 className="confirmed-title">{isPix ? 'Pix aprovado' : 'Pagamento aprovado'}</h1>
      <p className="confirmed-sub" style={{ color: '#00C851', marginBottom: '30px' }}>
        {isPix
          ? 'Pagamento confirmado.'
          : 'Pagamento confirmado pelo fotógrafo. Fotos liberadas após validação no painel.'}
      </p>

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

      <div className="delivery-options">
        <button className="delivery-btn" style={{ borderColor: '#25D366' }}>
          <span>💬</span>
          <div>
            <strong style={{ color: '#25D366' }}>{deliveryMeta.label}</strong>
            <small>Fotos sendo tratadas para {clientPhone || 'o cliente'}</small>
          </div>
        </button>
      </div>

      {!shareToken ? (
        <button
          className="btn-outline-white"
          style={{ marginTop: '30px' }}
          onClick={() => {
            resetSession();
            setScreen('dashboard');
            fetchDashboard({ silent: true });
          }}
        >
          Finalizar e abordar próximo cliente
        </button>
      ) : null}
      {noticeBanner}
    </div>
  );
}
