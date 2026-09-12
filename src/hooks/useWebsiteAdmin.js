import { useCallback, useEffect, useRef, useState } from 'react';
import { websiteRequest } from '../lib/websiteApi';

export function useWebsiteAdmin(adminHeaders) {
  const headersRef = useRef(adminHeaders);
  useEffect(() => { headersRef.current = adminHeaders; }, [adminHeaders]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setError('');
    try { setData(await websiteRequest('/api/admin/website', { headers: headersRef.current() })); }
    catch (failure) { setError(failure.message); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  async function change(path, method, body) {
    setBusy(true);
    setError('');
    try {
      const result = await websiteRequest(`/api/admin/website${path}`, {
        method, headers: { ...headersRef.current(), 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      setData(result);
    } catch (failure) { setError(failure.message); await refresh(); setError(failure.message); }
    finally { setBusy(false); }
  }
  return { data, error, busy, refresh, change };
}
