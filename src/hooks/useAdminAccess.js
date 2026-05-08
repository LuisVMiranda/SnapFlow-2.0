import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';
import { deleteCookie, getCookie, setCookie } from '../lib/cookies';

const ADMIN_TOKEN_STORAGE_KEY = 'snapflow-admin-token';
const ADMIN_TOKEN_COOKIE_NAME = 'snapflow-admin-token';
const REMEMBER_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function readStoredAdminToken() {
  if (typeof window === 'undefined') return { token: '', remembered: false };
  const cookieToken = getCookie(ADMIN_TOKEN_COOKIE_NAME);
  if (cookieToken) return { token: cookieToken, remembered: true };
  return {
    token: window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '',
    remembered: false,
  };
}

export function useAdminAccess() {
  const storedAdmin = readStoredAdminToken();
  const [adminToken, setAdminToken] = useState(storedAdmin.token);
  const [adminRemember, setAdminRemember] = useState(storedAdmin.remembered);
  const [adminAccessStatus, setAdminAccessStatus] = useState(() =>
    storedAdmin.token ? 'checking' : 'idle'
  );
  const [adminAccessError, setAdminAccessError] = useState('');
  const [adminAttemptsRemaining, setAdminAttemptsRemaining] = useState(5);

  const adminHeaders = useCallback(
    (extra = {}) => ({
      ...extra,
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    }),
    [adminToken]
  );

  const adminJsonHeaders = useCallback(
    () => adminHeaders({ 'Content-Type': 'application/json' }),
    [adminHeaders]
  );

  const persistAdminToken = useCallback((token, remember) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    deleteCookie(ADMIN_TOKEN_COOKIE_NAME);
    if (!token) return;

    if (remember) setCookie(ADMIN_TOKEN_COOKIE_NAME, token, REMEMBER_MAX_AGE_SECONDS);
    else window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  }, []);

  const verifyAdminToken = useCallback(async (token) => {
    const response = await fetch(`${API_BASE_URL}/api/admin/access`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await readJsonResponse(response);
    return { data, response };
  }, []);

  const logoutAdmin = useCallback(() => {
    setAdminToken('');
    setAdminRemember(false);
    setAdminAccessStatus('idle');
    setAdminAccessError('');
    setAdminAttemptsRemaining(5);
    persistAdminToken('', false);
  }, [persistAdminToken]);

  const loginAdmin = useCallback(
    async ({ token, remember }) => {
      const cleanToken = String(token || '').trim();
      if (!cleanToken) {
        setAdminAccessStatus('idle');
        setAdminAccessError('Informe a credencial administrativa.');
        return false;
      }

      setAdminAccessStatus('checking');
      setAdminAccessError('');

      try {
        const { data, response } = await verifyAdminToken(cleanToken);
        if (response.ok && data.ok) {
          setAdminToken(cleanToken);
          setAdminRemember(Boolean(remember));
          setAdminAttemptsRemaining(5);
          setAdminAccessStatus('granted');
          setAdminAccessError('');
          persistAdminToken(cleanToken, Boolean(remember));
          return true;
        }

        setAdminAccessStatus(response.status === 429 ? 'locked' : 'denied');
        setAdminAccessError(
          buildApiErrorMessage('Não foi possível entrar na conta administrativa.', response, data)
        );
        setAdminAttemptsRemaining(data.details?.attemptsRemaining ?? 0);
        persistAdminToken('', false);
        return false;
      } catch (error) {
        setAdminAccessStatus('denied');
        setAdminAccessError(buildNetworkErrorMessage('Não foi possível validar a credencial administrativa.', error));
        return false;
      }
    },
    [persistAdminToken, verifyAdminToken]
  );

  useEffect(() => {
    let cancelled = false;

    async function verifyStoredToken() {
      if (!adminToken || adminAccessStatus !== 'checking') return;

      try {
        const { data, response } = await verifyAdminToken(adminToken);
        if (cancelled) return;

        if (response.ok && data.ok) {
          setAdminAccessStatus('granted');
          setAdminAccessError('');
          return;
        }

        setAdminAccessStatus(response.status === 429 ? 'locked' : 'denied');
        setAdminAccessError(
          buildApiErrorMessage('Não foi possível validar a sessão administrativa.', response, data)
        );
        setAdminAttemptsRemaining(data.details?.attemptsRemaining ?? 0);
        persistAdminToken('', false);
      } catch (error) {
        if (cancelled) return;
        setAdminAccessStatus('denied');
        setAdminAccessError(buildNetworkErrorMessage('Não foi possível validar a sessão administrativa.', error));
      }
    }

    verifyStoredToken();

    return () => {
      cancelled = true;
    };
  }, [adminAccessStatus, adminToken, persistAdminToken, verifyAdminToken]);

  const isAdminUnlocked = adminAccessStatus === 'granted';

  const withAdminMediaToken = useCallback(
    (url) => {
      if (!isAdminUnlocked || !adminToken || !url || typeof window === 'undefined') return url;
      const parsed = new URL(url, window.location.origin);
      parsed.searchParams.set('admin_token', adminToken);
      return parsed.pathname + parsed.search;
    },
    [adminToken, isAdminUnlocked]
  );

  return {
    adminAccessError,
    adminAccessStatus,
    adminAttemptsRemaining,
    adminHeaders,
    adminJsonHeaders,
    adminRemember,
    adminToken,
    isAdminUnlocked,
    loginAdmin,
    logoutAdmin,
    withAdminMediaToken,
  };
}
