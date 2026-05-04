export function formatMoney(value) {
  return `R$\u00a0${value.toFixed(2).replace('.', ',')}`;
}

export function formatRemainingCountdown(isoDate, nowMs = Date.now()) {
  if (!isoDate) return 'sem expiração';
  const expiresAt = new Date(isoDate).getTime();
  if (!Number.isFinite(expiresAt)) return 'sem expiração';

  const diffMs = Math.max(0, expiresAt - nowMs);
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds <= 0) return 'expira agora';
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
