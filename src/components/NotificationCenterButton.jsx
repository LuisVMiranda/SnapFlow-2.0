import { Bell } from 'lucide-react';

function formatNoticeTime(isoDate) {
  if (!isoDate) return '';
  const parsed = new Date(isoDate);
  if (!Number.isFinite(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function NotificationCenterButton({
  items = [],
  onClear = () => {},
  onToggle = () => {},
  open = false,
  unreadCount = 0,
}) {
  return (
    <div className="notification-center">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Notificações"
        className="notification-center-toggle"
        type="button"
        onClick={onToggle}
      >
        <Bell size={16} strokeWidth={2.1} />
        <span>Notificações</span>
        {unreadCount > 0 ? <span className="notification-center-count">{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notification-center-panel" role="dialog" aria-label="Central de notificações">
          <div className="notification-center-header">
            <strong>Notificações</strong>
            <button className="notification-center-clear" type="button" onClick={onClear}>
              Limpar
            </button>
          </div>
          {items.length ? (
            <div className="notification-center-list">
              {items.map((item) => (
                <div className={`notification-center-item ${item.tone || 'info'}`} key={item.id}>
                  <div className="notification-center-item-header">
                    <small>{formatNoticeTime(item.createdAt)}</small>
                  </div>
                  <span>{item.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="notification-center-empty">
              Nenhuma notificação nesta sessão. Os avisos somem sozinhos após 5 segundos.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
