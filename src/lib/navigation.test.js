import { describe, expect, it } from 'vitest';
import { resolveInitialScreen } from './navigation';

describe('resolveInitialScreen', () => {
  it('falls back to dashboard when a stale share-lock screen exists without a share token', () => {
    expect(resolveInitialScreen({ savedScreen: 'share-lock' })).toBe('dashboard');
  });

  it('keeps valid admin screens without a share token', () => {
    expect(resolveInitialScreen({ savedScreen: 'dashboard' })).toBe('dashboard');
    expect(resolveInitialScreen({ savedScreen: 'gallery' })).toBe('gallery');
  });

  it('requires the lock screen when the URL has a share token but no matching access token', () => {
    expect(resolveInitialScreen({ shareToken: 'abc', savedScreen: 'gallery' })).toBe('share-lock');
  });

  it('does not treat an admin-created share link as unlocked customer access', () => {
    expect(resolveInitialScreen({
      shareToken: 'abc',
      savedScreen: 'summary',
      savedShareAccess: { token: 'abc' },
    })).toBe('share-lock');
  });

  it('restores an unlocked share flow to the gallery instead of a stale checkout screen', () => {
    expect(resolveInitialScreen({
      shareToken: 'abc',
      savedScreen: 'summary',
      savedShareAccess: { token: 'abc', customerAccessToken: 'customer-token' },
    })).toBe('gallery');
  });
});
