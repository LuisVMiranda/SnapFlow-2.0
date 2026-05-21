import { CheckCircle2, ExternalLink } from 'lucide-react';
import { formatMoney } from '../lib/formatters';

export function PendingManualApprovalPrompt({
  busySessionId = '',
  onApprove = () => {},
  onOpenApproval = () => {},
  sessions = [],
}) {
  const pendingSessions = Array.isArray(sessions) ? sessions.filter(Boolean) : [];
  if (!pendingSessions.length) return null;

  const session = pendingSessions[0];
  const extraCount = Math.max(0, pendingSessions.length - 1);
  const clientLabel = session.clientName || session.phone || 'Cliente sem nome';

  return (
    <aside className="pending-admin-approval" role="status" aria-live="polite">
      <div className="pending-admin-approval-copy">
        <strong>Pagamento em dinheiro/cartão pendente</strong>
        <span>
          {clientLabel} • {session.photoCount || 0} foto(s) • {formatMoney(Number(session.amount) || 0)}
        </span>
        {extraCount ? <small>Mais {extraCount} pedido(s) aguardando em Vendas.</small> : null}
      </div>
      <div className="pending-admin-approval-actions">
        <button
          className="share-quick-btn approve-session-btn"
          disabled={busySessionId === session.id}
          onClick={() => onApprove(session.id)}
          type="button"
        >
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {busySessionId === session.id ? 'Liberando...' : 'Liberar fotos'}
        </button>
        <button className="share-quick-btn" onClick={() => onOpenApproval(session.id)} type="button">
          <ExternalLink size={14} strokeWidth={2.4} />
          Abrir aprovação
        </button>
      </div>
    </aside>
  );
}
