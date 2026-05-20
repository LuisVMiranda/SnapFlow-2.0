import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNoticeCenter } from './useNoticeCenter';

describe('useNoticeCenter', () => {
  it('auto-dismisses the active notice after 5 seconds', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useNoticeCenter());

    act(() => {
      result.current.setNotice('Pix confirmado pelo Mercado Pago.');
    });

    expect(result.current.activeNotice.message).toBe('Pix confirmado pelo Mercado Pago.');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.activeNotice).toBeNull();
    vi.useRealTimers();
  });
});
