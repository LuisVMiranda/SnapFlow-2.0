import { X } from 'lucide-react';

export function NoticeBanner({ notice, onClose }) {
  if (!notice) return null;

  const message = typeof notice === 'string' ? notice : notice.message;
  const tone = typeof notice === 'string' ? 'success' : notice.tone || 'success';

  return (
    <div className={`floating-notice ${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button
        aria-label="Fechar notificação"
        className="floating-notice-close"
        onClick={onClose}
        type="button"
      >
        <X size={14} strokeWidth={2.6} />
      </button>
    </div>
  );
}
