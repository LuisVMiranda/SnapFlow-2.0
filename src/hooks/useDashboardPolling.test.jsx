import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { paymentNotifications, useDashboardPolling } from './useDashboardPolling';

describe('paymentNotifications', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ignores stale approved Pix sessions when deciding top-right notifications', () => {
    const staleApprovedSession = {
      id: 'pix_old',
      amount: 50,
      photoCount: 6,
      paymentMethod: 'PIX',
      status: 'approved',
      clientName: 'Jacilda',
      approvedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    };

    const result = paymentNotifications([staleApprovedSession], () => false);

    expect(result.notifications).toEqual([]);
  });

  it('returns only fresh unseen payment notifications', () => {
    const freshPixSession = {
      id: 'pix_new',
      amount: 60,
      photoCount: 4,
      paymentMethod: 'PIX',
      status: 'approved',
      clientName: 'Bia',
      approvedAt: new Date().toISOString(),
    };
    const manualSession = {
      id: 'manual_1',
      amount: 40,
      photoCount: 3,
      paymentMethod: 'Dinheiro/Cartão',
      status: 'pending',
      clientName: 'Carlos',
    };

    const result = paymentNotifications(
      [freshPixSession, manualSession],
      vi.fn((key) => key === 'manual-pending:manual_1')
    );

    expect(result.pendingManual).toHaveLength(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].key).toBe('pix-approved:pix_new');
    expect(result.notifications[0].message).toMatch(/Bia/);
  });

  it('polls shared-gallery screens immediately for admin pending manual approvals', async () => {
    vi.useFakeTimers();
    const manualSession = {
      amount: 45,
      clientName: 'Dudis',
      id: 'manual_1',
      paymentMethod: 'Dinheiro/Cartão',
      photoCount: 3,
      status: 'pending',
    };
    const rememberNotifications = vi.fn();
    const setDashData = vi.fn();
    const setNotice = vi.fn();
    const setPendingManualSessions = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ chartSeries: {}, recent: [manualSession], shareRecent: [], stats: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useDashboardPolling({
      adminHeaders: () => ({ Authorization: 'Bearer admin-secret' }),
      hasSeenNotification: () => false,
      isAdminUnlocked: true,
      rememberNotifications,
      setDashData,
      setNotice,
      setPendingManualSessions,
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(setPendingManualSessions).toHaveBeenCalledWith([manualSession]);
    expect(setDashData).toHaveBeenCalledWith(expect.objectContaining({ recent: [manualSession] }));
    expect(setNotice).toHaveBeenCalledWith(expect.objectContaining({ key: 'manual-pending:manual_1' }));
    expect(rememberNotifications).toHaveBeenCalledWith(['manual-pending:manual_1']);
  });
});
