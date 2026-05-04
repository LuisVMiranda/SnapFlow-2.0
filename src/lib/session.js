export function createSessionId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `sess_${crypto.randomUUID()}`
    : `sess_${Math.random().toString(36).slice(2, 11)}`;
}
