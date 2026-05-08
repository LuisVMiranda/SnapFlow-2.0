import { useCallback, useEffect, useState } from 'react';
import { AccountMenu } from '../components/AccountMenu';
import { SessionOpsCard } from '../components/SessionOpsCard';
import { API_BASE_URL, buildApiErrorMessage, buildNetworkErrorMessage, readJsonResponse } from '../lib/apiClient';
import { DEFAULT_PRICING } from '../lib/pricing';

export function AdminApprovalScreen({
  adminAccessError,
  adminAccessStatus,
  adminAttemptsRemaining,
  adminHeaders,
  adminRemember,
  fetchDashboard,
  isAdminUnlocked,
  loginAdmin,
  logoutAdmin,
  noticeBanner,
  pricingOptions = DEFAULT_PRICING,
  sessionId,
  setNotice,
}) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('idle');

  const loadSession = useCallback(async () => {
    if (!isAdminUnlocked || !sessionId) return;
    setStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/session/${sessionId}`, {
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(buildApiErrorMessage('Não foi possível carregar a sessão de aprovação.', response, data));
      setSession(data);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setNotice(buildNetworkErrorMessage('Não foi possível carregar a sessão de aprovação.', error));
    }
  }, [adminHeaders, isAdminUnlocked, sessionId, setNotice]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const approve = async () => {
    if (!sessionId) return;
    setStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/approve-manual-session/${sessionId}`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(buildApiErrorMessage('Não foi possível liberar as fotos.', response, data));
      setSession(data.session);
      setStatus('ready');
      setNotice('Fotos liberadas para entrega.');
      fetchDashboard({ silent: true });
    } catch (error) {
      setStatus('error');
      setNotice(buildNetworkErrorMessage('Não foi possível liberar as fotos.', error));
    }
  };

  const alreadyApproved = session?.status === 'approved';
  const isPending = session?.status === 'pending';

  return (
    <div className="dashboard-screen screen approval-screen">
      <header className="dash-header">
        <div className="logo brand-logo">
          <img src="/logo-transparent.png" alt="SnapFlow" className="brand-logo-image" />
        </div>
        <nav className="dash-nav" aria-label="Conta">
          <AccountMenu
            adminAccessError={adminAccessError}
            adminAccessStatus={adminAccessStatus}
            adminAttemptsRemaining={adminAttemptsRemaining}
            adminRemember={adminRemember}
            isAdminUnlocked={isAdminUnlocked}
            loginAdmin={loginAdmin}
            logoutAdmin={logoutAdmin}
          />
        </nav>
      </header>

      <main className="dash-main approval-main">
        {!isAdminUnlocked ? (
          <section className="summary-card admin-locked-card">
            <div className="summary-label">Aprovação protegida</div>
            <small className="summary-help">Entre com a credencial administrativa para liberar esta venda.</small>
          </section>
        ) : (
          <section className="approval-panel">
            <h1>Aprovação de venda</h1>
            <small className="summary-help">Sessão {sessionId || 'não informada'}</small>

            {session ? (
              <SessionOpsCard
                title="Venda manual"
                stage={alreadyApproved ? 'Pagamento aprovado' : 'Aguardando aprovação'}
                count={session.photoCount || 0}
                total={Number(session.amount || 0)}
                phone={session.phone}
                packageType={session.packageType}
                pricingOptions={pricingOptions}
                paymentMethod={session.paymentMethod}
                paymentStatus={session.status}
                deliveryStatus={session.deliveryStatus}
                deliveryError={session.deliveryError}
              />
            ) : (
              <div className="summary-card">
                <div className="summary-label">{status === 'loading' ? 'Carregando venda...' : 'Venda não carregada'}</div>
              </div>
            )}

            <button className="btn-primary" type="button" onClick={approve} disabled={!isPending || status === 'saving'}>
              {alreadyApproved ? 'Fotos já liberadas' : status === 'saving' ? 'Liberando...' : 'Liberar fotos'}
            </button>
            <button className="btn-manual btn-manual-card" type="button" onClick={loadSession} disabled={status === 'loading'}>
              Atualizar status
            </button>
          </section>
        )}
        {noticeBanner}
      </main>
    </div>
  );
}
