import { useEffect } from 'react';
import { resolveInitialScreen } from '../lib/navigation';
import { detectShareToken } from '../lib/share';

export function getSavedSnapFlowState(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem('snapflow-' + key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function resolveInitialSnapFlowScreen() {
  const token = detectShareToken();
  const savedScreen = getSavedSnapFlowState('screen', 'dashboard');
  if (!token) return resolveInitialScreen({ savedScreen });
  return resolveInitialScreen({
    shareToken: token,
    savedScreen,
    savedShareAccess: getSavedSnapFlowState('share-access', null),
  });
}

export function usePersistSnapFlowState({
  clientEmail,
  clientName,
  clientPhone,
  liveOps,
  manualDiscountDraft,
  manualDiscountEnabled,
  pixCopyPaste,
  pixWhatsAppMessage,
  qrCodeBase64,
  screen,
  selected,
  sessionId,
  type,
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const values = {
        screen,
        type,
        selected,
        clientPhone,
        clientName,
        clientEmail,
        manualDiscountEnabled,
        manualDiscountDraft,
        sessionId,
        qrCodeBase64,
        pixCopyPaste,
        pixWhatsAppMessage,
        liveOps,
      };
      Object.entries(values).forEach(([key, value]) => {
        window.localStorage.setItem('snapflow-' + key, JSON.stringify(value));
      });
    } catch {
      // Local persistence is helpful, not required for checkout correctness.
    }
  }, [
    clientEmail,
    clientName,
    clientPhone,
    liveOps,
    manualDiscountDraft,
    manualDiscountEnabled,
    pixCopyPaste,
    pixWhatsAppMessage,
    qrCodeBase64,
    screen,
    selected,
    sessionId,
    type,
  ]);
}
