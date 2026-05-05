export function NoticeBanner({ notice, onClose }) {
  if (!notice) return null;

  return (
    <div className="floating-notice" role="status" aria-live="polite">
      <span>{notice}</span>
      <button
        aria-label="Fechar notificação"
        className="floating-notice-close"
        onClick={onClose}
        type="button"
      >
        X
      </button>
    </div>
  );
}
