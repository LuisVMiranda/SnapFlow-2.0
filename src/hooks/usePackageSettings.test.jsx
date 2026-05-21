import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePackageSettings } from './usePackageSettings';

function makeConfig(overrides = {}) {
  return {
    adminJsonHeaders: () => ({ 'Content-Type': 'application/json' }),
    currentType: 'eventos',
    isAdminUnlocked: false,
    setNotice: vi.fn(),
    setType: vi.fn(),
    ...overrides,
  };
}

describe('usePackageSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not replace an unknown shared-gallery package while package settings load', async () => {
    const setType = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        eventos: { label: 'Eventos', shortLabel: 'Eventos', unit: 15, bulk: 10, threshold: 5 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ));

    renderHook(() => usePackageSettings(makeConfig({
      currentType: 'marco_dos_corais',
      preserveUnknownType: true,
      setType,
    })));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(setType).not.toHaveBeenCalled();
  });
});
