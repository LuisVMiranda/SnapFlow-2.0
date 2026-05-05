import { useEffect } from 'react';
import { API_BASE_URL } from '../lib/apiClient';
import { formatMoney } from '../lib/formatters';

function browserNotify(notification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification(notification.title, {
    body: notification.browserBody,
    icon: '/logo-transparent.png',
    tag: notification.key,
  });
}

function paymentNotifications(sessions = [], notifiedSessions) {
  const pendingManual = sessions.filter(
    (session) => session.status === 'pending' && session.paymentMethod === 'Dinheiro/Cartão'
  );
  const confirmedPix = sessions.filter(
    (session) => session.status === 'approved' && session.paymentMethod === 'PIX'
  );
  const notifications = [];

  pendingManual.forEach((session) => {
    const key = `manual-pending:${session.id}`;
    if (notifiedSessions.has(key)) return;
    notifications.push({
      key,
      title: 'SnapFlow - Pagamento pendente',
      message: 'Novo pagamento em dinheiro/cartão. Cliente: ' + (session.clientName || session.phone || session.accessCode),
      browserBody: 'Cliente solicitou pagamento em dinheiro/cartão. ' + session.photoCount + ' foto(s) - ' + formatMoney(session.amount),
    });
  });

  confirmedPix.forEach((session) => {
    const key = `pix-approved:${session.id}`;
    if (notifiedSessions.has(key)) return;
    notifications.push({
      key,
      title: 'SnapFlow - Pix confirmado',
      message: 'Pix confirmado pelo Mercado Pago. ' + (session.clientName || session.phone || 'Cliente') + ' teve as fotos liberadas.',
      browserBody: 'Pagamento aprovado: ' + formatMoney(session.amount) + ' - ' + session.photoCount + ' foto(s).',
    });
  });

  return { notifications, pendingManual };
}

export function useDashboardPolling({
  adminHeaders,
  isAdminUnlocked,
  notifiedSessions,
  screen,
  setDashData,
  setNotice,
  setNotifiedSessions,
  setPendingManualSessions,
  shareToken,
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
        if (shareToken) return;

        const { notifications, pendingManual } = paymentNotifications(data.recent, notifiedSessions);
        if (notifications.length) {
          setNotice(notifications[0].message);
          notifications.forEach(browserNotify);
          setNotifiedSessions((previous) => {
            const next = new Set(previous);
            notifications.forEach((notification) => next.add(notification.key));
            return next;
          });
        }
        setPendingManualSessions(pendingManual);
      } catch {
        // Background dashboard polling should stay quiet.
      }
    };

    if (screen === 'dashboard') {
      loadDashboard();
    }

    const interval = setInterval(() => {
      if (!shareToken) {
        loadDashboard();
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    adminHeaders,
    isAdminUnlocked,
    notifiedSessions,
    screen,
    setDashData,
    setNotice,
    setNotifiedSessions,
    setPendingManualSessions,
    shareToken,
  ]);
}
