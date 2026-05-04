import { LogOut, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AccountMenu({
  adminAccessError,
  adminAccessStatus,
  adminAttemptsRemaining,
  adminRemember,
  isAdminUnlocked,
  loginAdmin,
  logoutAdmin,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [remember, setRemember] = useState(Boolean(adminRemember));

  useEffect(() => {
    setRemember(Boolean(adminRemember));
  }, [adminRemember]);

  const isChecking = adminAccessStatus === 'checking';
  const isLocked = adminAccessStatus === 'locked';
  const statusLabel = {
    checking: 'Validando credenciais...',
    denied: adminAccessError || 'Credencial inválida.',
    granted: 'Conta administrativa ativa.',
    idle: 'Entre com a credencial administrativa.',
    locked: adminAccessError || 'Limite de tentativas atingido.',
  }[adminAccessStatus || 'idle'];

  const handleSubmit = async (event) => {
    event.preventDefault();
    const success = await loginAdmin({ token: tokenInput, remember });
    if (success) {
      setTokenInput('');
      setIsOpen(false);
    }
  };

  return (
    <div className="account-menu">
      <button
        type="button"
        className={`account-button ${isAdminUnlocked ? 'active' : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label="Abrir conta administrativa"
      >
        <User size={18} />
        <span>{isAdminUnlocked ? 'Admin' : 'Conta'}</span>
      </button>

      {isOpen ? (
        <div className="account-modal-backdrop" role="presentation">
          <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
            <header className="account-modal-header">
              <div>
                <h2 id="account-title">Conta administrativa</h2>
                <small>{isAdminUnlocked ? 'Sessão ativa' : 'Acesso protegido'}</small>
              </div>
              <button type="button" className="account-icon-button" onClick={() => setIsOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>

            {isAdminUnlocked ? (
              <div className="account-session">
                <p>{statusLabel}</p>
                <button
                  type="button"
                  className="btn-manual btn-manual-card"
                  onClick={() => {
                    logoutAdmin();
                    setTokenInput('');
                    setIsOpen(false);
                  }}
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            ) : (
              <form className="account-form" onSubmit={handleSubmit}>
                <label htmlFor="admin-token">Credencial</label>
                <input
                  id="admin-token"
                  type="password"
                  placeholder="ADMIN_ACCESS_TOKEN"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  className="phone-input"
                  autoComplete="current-password"
                  disabled={isChecking || isLocked}
                />

                <label className="account-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    disabled={isChecking || isLocked}
                  />
                  Manter login neste dispositivo
                </label>

                <small className={`summary-help admin-token-status ${adminAccessStatus === 'granted' ? 'success' : ''}`} aria-live="polite">
                  {statusLabel}
                  {!isLocked && adminAttemptsRemaining < 5
                    ? ` ${adminAttemptsRemaining} tentativa(s) restante(s).`
                    : ''}
                </small>

                <button className="btn-primary" type="submit" disabled={isChecking || isLocked || !tokenInput.trim()}>
                  {isChecking ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
