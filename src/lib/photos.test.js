import { afterEach, describe, expect, it } from 'vitest';
import { normalizePhotoUrl, photoIdFromUrl } from './photos';

describe('photo helpers', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('normalizes relative media URLs against the browser origin', () => {
    window.history.replaceState(null, '', '/dashboard');
    expect(normalizePhotoUrl('/api/media/photo-1/thumb')).toBe('http://localhost:3000/api/media/photo-1/thumb');
  });

  it('derives stable photo ids from URLs', () => {
    expect(photoIdFromUrl('/api/media/photo-2/preview', 0)).toBe('preview');
    expect(photoIdFromUrl('', 3)).toBe('photo-3');
  });
});
