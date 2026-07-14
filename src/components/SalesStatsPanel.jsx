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

const NOTIFICATION_META = {
  idle: { label: 'Aviso não agendado', tone: 'neutral' },
  pending: { label: 'Aviso na fila', tone: 'info' },
  running: { label: 'Enviando aviso', tone: 'info' },
  sent: { label: 'Aviso enviado', tone: 'success' },
  failed: { label: 'Aviso falhou', tone: 'danger' },
  cancelled: { label: 'Aviso cancelado', tone: 'neutral' },
};

function deliveryFailureHint(error) {
  const message = String(error || '').trim();
  if (!message) return 'O envio falhou, mas a API não retornou detalhes. Confira se o WhatsApp está pareado e tente reenviar.';
  if (message.includes('WhatsApp ainda')) {
    return `${message} Abra Galerias > WhatsApp de envio, escaneie o QR Code no painel quando aparecer e tente reenviar.`;
  }
  if (message.includes('Número não encontrado') || message.includes('Telefone') || message.includes('WhatsApp brasileiro')) {
    return `${message} Corrija o WhatsApp do cliente na galeria ou na venda antes de reenviar.`;
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

function StatsBreakdownTable({ periodConfig, series = [] }) {
  const rows = [...series].reverse();
  const title = periodConfig.key === 'hoje' ? 'Detalhamento por dia' : `Detalhamento ${periodConfig.label.toLowerCase()}`;
  const subtitle = periodConfig.key === 'hoje'
    ? 'Valores agrupados pela data em que o pagamento foi aprovado nos últimos 7 dias.'
    : 'Valores agrupados pela data em que o pagamento foi aprovado no período selecionado.';

  return (
    <div className="stats-breakdown-card">
      <div>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>

      {rows.length ? (
        <div className="stats-breakdown-scroll">
          <table className="stats-breakdown-table">
            <thead>
              <tr>
                <th>{periodConfig.key === 'hoje' ? 'Dia' : 'Período'}</th>
                <th>Valor</th>
                <th>Sessões</th>
                <th>Fotos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={`${periodConfig.key}-${item.label}`}>
                  <td>{item.label}</td>
                  <td className="positive">{formatMoney(item.valor)}</td>
                  <td>{item.sessoes}</td>
                  <td>{item.fotos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <small>Nenhuma venda aprovada neste período ainda.</small>
      )}
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
      if (data.session.deliveryStatus === 'failed') {
        setNotice(`Envio falhou novamente: ${deliveryFailureHint(data.session.deliveryError)}`);
      } else if (data.session.deliveryStatus === 'sent') {
        setNotice('Fotos reenviadas com sucesso.');
      } else {
        setNotice('Entrega reenfileirada. Deixe o WhatsApp pareado e aberto para concluir o envio.');
      }
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível reenfileirar o envio.', error));
    }
  };

  const retryNotification = async (targetSessionId) => {
    if (!targetSessionId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/sessions/${targetSessionId}/retry-notification`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setNotice(buildApiErrorMessage('Não foi possível reenviar o aviso.', response, data));
        return;
      }
      setNotice(data.job?.status === 'sent' ? 'Aviso reenviado com sucesso.' : 'Aviso reenfileirado.');
      fetchDashboard({ silent: true });
    } catch (error) {
      setNotice(buildNetworkErrorMessage('Não foi possível reenviar o aviso.', error));
    }
  };

  const clearStats = async () => {
    if (!window.confirm('Deseja apagar o histórico de vendas e estatísticas As galerias compartilhadas continuarão na aba Galerias.')) return;
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
    if (!window.confirm('Cancelar a liberação desta venda O cliente não receberá as fotos por esta solicitação.')) return;
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
        <div className="stats-footnote">
          O resumo financeiro usa a data em que o pagamento foi aprovado, para o valor entrar no dia correto.
        </div>
        <StatsBreakdownTable periodConfig={periodConfig} series={series} />
      </div>

      <ConversionFunnelCard funnel={dashData.conversionFunnel || []} />

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
        retryNotification={retryNotification}
        setNotice={setNotice}
      />
    </section>
  );
}

function ConversionFunnelCard({ funnel = [] }) {
  if (!funnel.length) return null;
  const max = Math.max(1, ...funnel.map((item) => Number(item.count) || 0));

  return (
    <div className="stats-breakdown-card">
      <div>
        <strong>Funil de conversão de hoje</strong>
        <small>Eventos do link até a entrega, para enxergar onde a venda trava.</small>
      </div>
      <div className="conversion-funnel-list">
        {funnel.map((item) => {
          const width = Math.max(4, Math.round(((Number(item.count) || 0) / max) * 100));
          return (
            <div className="conversion-funnel-row" key={item.type}>
              <div>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
              <div className="conversion-funnel-track">
                <div className="conversion-funnel-fill" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentSessions({ adminHeaders, cancelRelease, dashData, fetchDashboard, pricingOptions, retryDelivery, retryNotification, setNotice }) {
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
        const notificationMeta = NOTIFICATION_META[session.notificationStatus || 'idle'] || NOTIFICATION_META.idle;

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
              {session.shareToken && session.status === 'approved' ? (
                <span className={`badge badge-${notificationMeta.tone}`}>{notificationMeta.label}</span>
              ) : null}
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
              {session.status === 'approved' && session.shareToken && ['idle', 'failed'].includes(session.notificationStatus || 'idle') ? (
                <button className="share-quick-btn approve-session-btn" onClick={() => retryNotification(session.id)}>
                  {session.notificationStatus === 'failed' ? 'Reenviar aviso' : 'Enviar aviso'}
                </button>
              ) : null}
              {session.deliveryStatus === 'failed' ? (
                <small className="delivery-failure-note">{deliveryFailureHint(session.deliveryError)}</small>
              ) : null}
              {session.notificationStatus === 'failed' ? (
                <small className="delivery-failure-note">Aviso: {deliveryFailureHint(session.notificationError)}</small>
              ) : null}
            </div>
          </div>
        );
      })}

      {dashData.recent.length === 0 ? <div className="empty-state">Nenhuma sessão recente</div> : null}
    </div>
  );
}
