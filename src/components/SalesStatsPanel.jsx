import { SessionOpsCard } from './SessionOpsCard';
import { formatMoney } from '../lib/formatters';
import { DELIVERY_META, PAYMENT_META, packageLabel } from '../lib/pricing';
import { API_BASE_URL } from '../lib/apiClient';

const PERIODS = [
  { key: 'hoje', label: 'Diário', seriesKey: 'diario' },
  { key: 'semana', label: 'Semanal', seriesKey: 'semanal' },
  { key: 'mes', label: 'Mensal', seriesKey: 'mensal' },
  { key: 'ano', label: 'Anual', seriesKey: 'anual' },
];

function MiniBarChart({ series = [] }) {
  const max = Math.max(1, ...series.map((item) => Number(item.valor) || 0));
  return (
    <div className="mini-chart" aria-label="Gráfico de vendas">
      {series.map((item) => {
        const height = Math.max(8, Math.round(((Number(item.valor) || 0) / max) * 100));
        return (
          <div className="mini-chart-item" key={item.label}>
            <div className="mini-chart-bar" style={{ height: `${height}%` }} title={`${item.label}: ${formatMoney(item.valor)}`} />
            <small>{item.label}</small>
          </div>
        );
      })}
    </div>
  );
}

export function SalesStatsPanel({
  activeStage,
  adminHeaders,
  clientPhone,
  count,
  dashData,
  fetchDashboard,
  hasActiveSession,
  liveOps,
  period,
  pricingOptions,
  setPeriod,
  total,
  type,
}) {
  const periodConfig = PERIODS.find((item) => item.key === period) || PERIODS[0];
  const stats = dashData.stats?.[period] || { valor: 0, fotos: 0, sessoes: 0 };
  const series = dashData.chartSeries?.[periodConfig.seriesKey] || [];

  return (
    <section className="admin-panel">
      <div className="period-tabs">
        {PERIODS.map((item) => (
          <button key={item.key} className={period === item.key ? 'active' : ''} onClick={() => setPeriod(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="stats-card">
        <div className="stats-title">Vendas ({periodConfig.label})</div>
        <div className="stats-value">{formatMoney(stats.valor)}</div>
        <div className="stats-subtitle">
          {stats.sessoes} sessões • {stats.fotos} fotos vendidas
        </div>
        <MiniBarChart series={series} />
      </div>

      {hasActiveSession ? (
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
      ) : null}

      <RecentSessions adminHeaders={adminHeaders} dashData={dashData} fetchDashboard={fetchDashboard} pricingOptions={pricingOptions} />
    </section>
  );
}

function RecentSessions({ adminHeaders, dashData, fetchDashboard, pricingOptions }) {
  return (
    <div className="recent-sessions">
      <div className="recent-header">
        <h3>Sessões recentes</h3>
      </div>

      {dashData.recent.map((session) => {
        const paymentMeta = session.status === 'approved' ? PAYMENT_META.approved : PAYMENT_META.pending;
        const deliveryMeta = DELIVERY_META[session.deliveryStatus || 'idle'] || DELIVERY_META.idle;

        return (
          <div key={session.id} className="session-item" style={{ flexWrap: 'wrap' }}>
            <div className="session-info">
              <strong>{formatMoney(Number(session.amount) || 0)}</strong>
              <small>
                {session.photoCount} foto(s) • {packageLabel(session.packageType, pricingOptions)}
              </small>
              {session.accessCode ? <small className="session-code">Código: {session.accessCode} • {session.phone}</small> : null}
            </div>
            <div className="session-status dashboard-session-status">
              <span className={`badge badge-${paymentMeta.tone}`}>{paymentMeta.label}</span>
              <span className={`badge badge-${deliveryMeta.tone}`}>{deliveryMeta.label}</span>
              {session.status === 'pending' && session.paymentMethod === 'Dinheiro/Cartão' ? (
                <button
                  className="share-quick-btn approve-session-btn"
                  onClick={async () => {
                    await fetch(`${API_BASE_URL}/api/admin/approve-manual-session/${session.id}`, {
                      method: 'POST',
                      headers: adminHeaders(),
                    });
                    fetchDashboard({ silent: true });
                  }}
                >
                  Liberar fotos
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      {dashData.recent.length === 0 ? <div className="empty-state">Nenhuma sessão recente</div> : null}
    </div>
  );
}
