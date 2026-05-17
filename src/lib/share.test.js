import { afterEach, describe, expect, it } from 'vitest';
import { buildShareWhatsAppMessage, detectShareToken, normalizeShareCode } from './share';

describe('share helpers', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('detects share tokens from route and query forms', () => {
    window.history.replaceState(null, '', '/s/abc123');
    expect(detectShareToken()).toBe('abc123');

    window.history.replaceState(null, '', '/?share=xyz789');
    expect(detectShareToken()).toBe('xyz789');
  });

  it('normalizes unlock codes to four safe characters', () => {
    expect(normalizeShareCode(' ab-12z ')).toBe('AB12');
  });

  it('builds a WhatsApp message with link and unlock code', () => {
    const message = buildShareWhatsAppMessage('https://snap.test/s/token', 'A1B2');

    expect(message).toContain('A1B2');
    expect(message).toContain('Acessar galeria privada: https://snap.test/s/token');
    expect(message).toContain('galeria privada SnapFlow');
  });
});
