import { ShareCountdown } from '../components/ShareCountdown';
import { normalizeShareCode } from '../lib/share';

export function ShareLockScreen({
  shareSessionInfo,
  shareCodeInput,
  setShareCodeInput,
  handleUnlockSharedSession,
  shareActionLoading,
  noticeBanner,
}) {
  const info = shareSessionInfo && typeof shareSessionInfo === 'object' ? shareSessionInfo : {};
  const shareExpired = info.expired || info.status === 'revoked';
  const galleryName = String(info.galleryName || '').trim();
  const galleryDescription = String(info.galleryDescription || '').trim();

  return (
    <div className="screen center-screen share-screen">
      <header className="topbar">
        <span className="topbar-title">SnapFlow compartilhado</span>
        <span />
        <span />
      </header>

      <div className="summary-card share-lock-card">
        <div className="summary-label">Acesso temporário do cliente</div>
        {galleryName ? <h2 className="share-lock-title">{galleryName}</h2> : null}
        {galleryDescription ? <p className="share-lock-description">{galleryDescription}</p> : null}
        <div className="summary-row">
          <span>Fotos disponíveis</span>
          <strong>{info.photoCount || '---'}</strong>
        </div>
        <div className="summary-row">
          <span>Expiração</span>
          <strong>
            <ShareCountdown isoDate={info.expiresAt} />
          </strong>
        </div>
        <div className="summary-row">
          <span>Status</span>
          <strong>{shareExpired ? 'Bloqueado' : 'Ativo'}</strong>
        </div>

        {info.error ? <div className="ops-error">{info.error}</div> : null}

        <input
          type="text"
          inputMode="text"
          placeholder="Código de 4 caracteres"
          value={shareCodeInput}
          onChange={(event) => setShareCodeInput(normalizeShareCode(event.target.value))}
          className="phone-input"
          style={{ marginTop: '12px', textTransform: 'uppercase' }}
          maxLength={4}
          disabled={shareExpired}
        />

        <button
          className="btn-primary"
          style={{ width: '100%', marginTop: '12px' }}
          onClick={handleUnlockSharedSession}
          disabled={shareActionLoading || shareExpired}
        >
          {shareActionLoading ? 'Abrindo acesso...' : 'Abrir galeria'}
        </button>

        <small className="summary-help">
          Digite o código simbólico que acompanha o link para liberar a galeria desta venda.
        </small>
      </div>

      {noticeBanner}
    </div>
  );
}
