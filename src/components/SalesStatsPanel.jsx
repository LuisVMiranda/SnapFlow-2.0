import { SessionOpsCard } from './SessionOpsCard';
import { formatMoney } from '../lib/formatters';
import { DELIVERY_META, PAYMENT_META, packageLabel } from '../lib/pricing';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';

const PERIODS = [
  { key: 'hoje', label: 'Diário', seriesKey: 'diario' },
  { key: 'semana', label: 'Semanal', seriesKey: 'semanal' },
  { key: 'mes', label: 'Mensal', seriesKey: 'mensal' },
  { key: 'ano', label: 'Anual', seriesKey: 'anual' },
];

function deliveryFailureHint(error) {
  const message = String(error || '').trim();
  if (!message) return 'O envio falhou, mas a API não retornou detalhes. Confira se o WhatsApp está pareado e tente reenviar.';
  if (message.includes('WhatsApp ainda')) {
    return `${message} Abra Galerias > WhatsApp de envio, escaneie o QR Code no painel quando aparecer e tente reenviar.`;
  }
  if (message.includes('Número não encontrado') || message.includes('Telefone') || message.includes('WhatsApp brasileiro')) {
    return `${message} Corrija o WhatsApp do cliente na galeria/venda antes de reenviar.`;
  }
  return message;
}

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
  sessionId,
  setNotice,
  setPeriod,
  total,
  type,
}) {
  const periodConfig = PERIODS.find((item) => item.key === period) || PERIODS[0];
  const stats = dashData.stats?.[period] || { valor: 0, fotos: 0, sessoes: 0 };
  const series = dashData.chartSeries?.[periodConfig.seriesKey] || [];
  const retryDelivery = async (targetSessionId) => {
    if (!targetSessionId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/sessions/${targetSessionId}/retry-delivery`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível reenfileirar o envio.', response, data));
        return;
      }
      if (data.session?.deliveryStatus === 'failed') {
        setNotice(`Envio falhou novamente: ${deliveryFailureHint(data.session.deliveryError)}`);
      } else if (data.session?.deliveryStatus === 'sent') {
        setNotice('Fotos reenviadas com sucesso.');
      } else {
        setNotice('Entrega reenfileirada. Deixe o WhatsApp pareado e aberto para concluir o envio.');
      }
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível reenfileirar o envio.', error));
    }
  };
  const clearStats = async () => {
    if (!window.confirm('Deseja apagar o histórico de vendas e estatísticas? As galerias compartilhadas continuarão na aba Galerias.')) return;
    if (!window.confirm('Confirme novamente: esta ação apaga as sessões de venda do painel.')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/stats/clear`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível limpar as estatísticas.', response, data));
        return;
      }
      setNotice(`${data.deletedSessions || 0} sessão(ões) removida(s) das estatísticas.`);
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível limpar as estatísticas.', error));
    }
  };
  const cancelRelease = async (targetSessionId) => {
    if (!targetSessionId) return;
    if (!window.confirm('Cancelar a liberação desta venda? O cliente não receberá as fotos por esta solicitação.')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/sessions/${targetSessionId}/cancel-release`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível cancelar a liberação.', response, data));
        return;
      }
      setNotice('Liberação cancelada. Esta venda não poderá mais ser aprovada por esse pedido.');
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível cancelar a liberação.', error));
    }
  };
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
        <div className="stats-card-header">
          <div className="stats-title">Vendas ({periodConfig.label})</div>
          <button className="share-quick-btn share-quick-btn-danger" type="button" onClick={clearStats}>
            Limpar estatísticas
          </button>
        </div>
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
          onRetryDelivery={liveOps.deliveryStatus === 'failed' ? () => retryDelivery(sessionId) : null}
        />
      ) : null}

      <RecentSessions
        adminHeaders={adminHeaders}
        dashData={dashData}
        fetchDashboard={fetchDashboard}
        pricingOptions={pricingOptions}
        cancelRelease={cancelRelease}
        retryDelivery={retryDelivery}
        setNotice={setNotice}
      />
    </section>
  );
}

function RecentSessions({ adminHeaders, cancelRelease, dashData, fetchDashboard, pricingOptions, retryDelivery, setNotice }) {
  return (
    <div className="recent-sessions">
      <div className="recent-header">
        <h3>Sessões recentes</h3>
      </div>

      {dashData.recent.map((session) => {
        const paymentMeta =
          session.status === 'approved'
            ? PAYMENT_META.approved
            : session.status === 'cancelled'
              ? PAYMENT_META.cancelled
              : session.paymentMethod === 'Dinheiro/Cartão'
                ? { label: 'Aguardando aprovação', tone: 'info' }
                : PAYMENT_META.pending;
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
                <>
                  <button
                    className="share-quick-btn approve-session-btn"
                    onClick={async () => {
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/admin/approve-manual-session/${session.id}`, {
                          method: 'POST',
                          headers: adminHeaders(),
                        });
                        const data = await readJsonResponse(response);
                        if (!response.ok) {
                          setNotice(buildApiErrorMessage('Não foi possível liberar as fotos.', response, data));
                          return;
                        }
                        setNotice('Fotos liberadas para entrega.');
                        fetchDashboard({ silent: true });
                      } catch (error) {
                        setNotice(buildNetworkErrorMessage('Não foi possível liberar as fotos.', error));
                      }
                    }}
                  >
                    Liberar fotos
                  </button>
                  <button className="share-quick-btn share-quick-btn-danger" type="button" onClick={() => cancelRelease(session.id)}>
                    Cancelar liberação
                  </button>
                </>
              ) : null}
              {session.status === 'approved' && session.deliveryStatus === 'failed' ? (
                <button className="share-quick-btn approve-session-btn" onClick={() => retryDelivery(session.id)}>
                  Reenviar fotos
                </button>
              ) : null}
              {session.deliveryStatus === 'failed' ? (
                <small className="delivery-failure-note">{deliveryFailureHint(session.deliveryError)}</small>
              ) : null}
            </div>
          </div>
        );
      })}

      {dashData.recent.length === 0 ? <div className="empty-state">Nenhuma sessão recente</div> : null}
    </div>
  );
}
