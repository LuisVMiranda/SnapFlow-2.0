import { useEffect } from 'react';
import { API_BASE_URL } from '../lib/apiClient';
import { formatMoney } from '../lib/formatters';
import { isFreshApprovalNotification } from '../lib/notifications';

function browserNotify(notification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification(notification.title, {
    body: notification.browserBody,
    icon: '/logo-transparent.png',
    tag: notification.key,
  });
}

export function paymentNotifications(sessions = [], hasSeenNotification = () => false, now = Date.now()) {
  const pendingManual = sessions.filter(
    (session) => session.status === 'pending' && session.paymentMethod === 'Dinheiro/Cartão'
  );
  const confirmedPix = sessions.filter(
    (session) =>
      session.status === 'approved'
      && session.paymentMethod === 'PIX'
      && isFreshApprovalNotification(session, now)
  );
  const notifications = [];

  pendingManual.forEach((session) => {
    const key = `manual-pending:${session.id}`;
    if (hasSeenNotification(key)) return;
    notifications.push({
      key,
      title: 'SnapFlow - Pagamento pendente',
      message: 'Novo pagamento em dinheiro/cartão. Cliente: ' + (session.clientName || session.phone || session.accessCode),
      browserBody: 'Cliente solicitou pagamento em dinheiro/cartão. ' + session.photoCount + ' foto(s) - ' + formatMoney(session.amount),
      tone: 'info',
    });
  });

  confirmedPix.forEach((session) => {
    const key = `pix-approved:${session.id}`;
    if (hasSeenNotification(key)) return;
    notifications.push({
      key,
      title: 'SnapFlow - Pix confirmado',
      message: 'Pix confirmado pelo Mercado Pago. ' + (session.clientName || session.phone || 'Cliente') + ' teve as fotos liberadas.',
      browserBody: 'Pagamento aprovado: ' + formatMoney(session.amount) + ' - ' + session.photoCount + ' foto(s).',
      tone: 'success',
    });
  });

  return { notifications, pendingManual };
}

export function useDashboardPolling({
  adminHeaders,
  hasSeenNotification,
  isAdminUnlocked,
  rememberNotifications,
  setDashData,
  setNotice,
  setPendingManualSessions,
}) {
  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (!isAdminUnlocked) return;
      try {
        const response = await fetch(API_BASE_URL + '/api/admin/dashboard', {
          headers: adminHeaders(),
        });
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled) return;

        setDashData(data);
        const { notifications, pendingManual } = paymentNotifications(data.recent, hasSeenNotification);
        if (notifications.length) {
          setNotice(notifications[0]);
          notifications.forEach(browserNotify);
          rememberNotifications(notifications.map((notification) => notification.key));
        }
        setPendingManualSessions(pendingManual);
      } catch {
        // Background dashboard polling should stay quiet.
      }
    };

    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    adminHeaders,
    hasSeenNotification,
    isAdminUnlocked,
    rememberNotifications,
    setDashData,
    setNotice,
    setPendingManualSessions,
  ]);
}
