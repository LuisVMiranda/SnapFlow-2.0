import { useCallback, useEffect, useState } from 'react';
import { inferNoticeTone, loadSeenNotifications, markSeenNotification, saveSeenNotifications } from '../lib/notifications';

const MAX_NOTICE_HISTORY = 8;

function buildNoticeEntry(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return {
      id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      key: '',
      tone: inferNoticeTone(value),
      message: value,
      createdAt: new Date().toISOString(),
    };
  }
  const message = String(value.message || '').trim();
  if (!message) return null;
  return {
    id: value.id || `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key: value.key || '',
    tone: value.tone || inferNoticeTone(message),
    message,
    createdAt: value.createdAt || new Date().toISOString(),
  };
}

export function useNoticeCenter() {
  const [activeNotice, setActiveNotice] = useState(null);
  const [noticeHistory, setNoticeHistory] = useState([]);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const [seenNotifications, setSeenNotifications] = useState(() => loadSeenNotifications());

  const setNotice = useCallback((value) => {
    if (!value) {
      setActiveNotice(null);
      return;
    }

    const nextNotice = buildNoticeEntry(value);
    if (!nextNotice) return;

    setActiveNotice(nextNotice);
    setNoticeHistory((previous) => {
      const filtered = nextNotice.key
        ? previous.filter((item) => item.key !== nextNotice.key)
        : previous.filter((item) => item.id !== nextNotice.id);
      return [nextNotice, ...filtered].slice(0, MAX_NOTICE_HISTORY);
    });
    setUnreadNoticeCount((previous) => (notificationCenterOpen ? 0 : previous + 1));
  }, [notificationCenterOpen]);

  const dismissNotice = useCallback(() => {
    setActiveNotice(null);
  }, []);

  const toggleNotificationCenter = useCallback(() => {
    setNotificationCenterOpen((previous) => {
      const next = !previous;
      if (next) setUnreadNoticeCount(0);
      return next;
    });
  }, []);

  const clearNotificationHistory = useCallback(() => {
    setActiveNotice(null);
    setNoticeHistory([]);
    setUnreadNoticeCount(0);
    setNotificationCenterOpen(false);
  }, []);

  const hasSeenNotification = useCallback((key) => Boolean(key && seenNotifications[key]), [seenNotifications]);

  const rememberNotifications = useCallback((keys) => {
    const normalizedKeys = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
    if (!normalizedKeys.length) return;
    setSeenNotifications((previous) => normalizedKeys.reduce((next, key) => markSeenNotification(next, key), previous));
  }, []);

  useEffect(() => {
    if (!activeNotice) return undefined;
    const timer = setTimeout(() => setActiveNotice((current) => (current?.id === activeNotice.id ? null : current)), 5000);
    return () => clearTimeout(timer);
  }, [activeNotice]);

  useEffect(() => {
    saveSeenNotifications(seenNotifications);
  }, [seenNotifications]);

  return {
    activeNotice,
    clearNotificationHistory,
    dismissNotice,
    hasSeenNotification,
    noticeHistory,
    notificationCenterOpen,
    rememberNotifications,
    setNotice,
    toggleNotificationCenter,
    unreadNoticeCount,
  };
}
