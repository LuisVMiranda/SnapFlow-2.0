export const DASHBOARD_NOTIFICATION_STORAGE_KEY = 'snapflow-seen-dashboard-notifications';
export const DASHBOARD_NOTIFICATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
export const APPROVAL_NOTIFICATION_FRESH_WINDOW_MS = 1000 * 60 * 30;

export function pruneSeenNotifications(entries = {}, now = Date.now()) {
  const normalized = Object.entries(entries || {}).reduce((next, [key, value]) => {
    const timestamp = Number(value);
    if (!key || !Number.isFinite(timestamp)) return next;
    if (now - timestamp > DASHBOARD_NOTIFICATION_TTL_MS) return next;
    next[key] = timestamp;
    return next;
  }, {});
  return normalized;
}

export function loadSeenNotifications(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(DASHBOARD_NOTIFICATION_STORAGE_KEY);
    if (!raw) return {};
    return pruneSeenNotifications(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveSeenNotifications(entries, storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return;
  try {
    storage.setItem(DASHBOARD_NOTIFICATION_STORAGE_KEY, JSON.stringify(pruneSeenNotifications(entries)));
  } catch {
    // Ignore storage failures in local-only UX helpers.
  }
}

export function markSeenNotification(entries = {}, key, now = Date.now()) {
  if (!key) return pruneSeenNotifications(entries, now);
  return pruneSeenNotifications({ ...entries, [key]: now }, now);
}

export function isFreshApprovalNotification(session, now = Date.now()) {
  const sourceDate = session.approvedAt || session.created_at;
  if (!sourceDate) return false;
  const timestamp = new Date(sourceDate).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return now - timestamp <= APPROVAL_NOTIFICATION_FRESH_WINDOW_MS;
}

export function inferNoticeTone(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return 'info';
  if (
    text.includes('não foi possível')
    || text.includes('falhou')
    || text.includes('inválid')
    || text.includes('expir')
    || text.includes('revogad')
    || text.includes('corrija')
    || text.includes('erro')
  ) {
    return 'danger';
  }
  if (
    text.includes('aguard')
    || text.includes('reconect')
    || text.includes('reenfileir')
    || text.includes('carreg')
    || text.includes('pendente')
  ) {
    return 'info';
  }
  return 'success';
}
