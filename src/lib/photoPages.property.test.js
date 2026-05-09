import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  derivePhotoPageCounts,
  mergePhotoPages,
  persistedShareStateIncludesPhotos,
} from './photoPages';

const photoArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter((value) => value.trim().length > 0),
  url: fc.webUrl(),
});

describe('photo page state properties', () => {
  it('merges pages without duplicating ids', () => {
    fc.assert(
      fc.property(
        fc.array(photoArbitrary, { maxLength: 80 }),
        fc.array(photoArbitrary, { maxLength: 80 }),
        (existing, incoming) => {
          const merged = mergePhotoPages(existing, incoming);
          const ids = merged.map((photo) => photo.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      )
    );
  });

  it('keeps existing page state unchanged when the incoming page is empty', () => {
    fc.assert(
      fc.property(fc.array(photoArbitrary, { maxLength: 80 }), (existing) => {
        const normalizedExisting = mergePhotoPages(existing, []);
        expect(mergePhotoPages(normalizedExisting, [])).toEqual(normalizedExisting);
      })
    );
  });

  it('keeps selected counters inside loaded and total bounds', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(photoArbitrary, { selector: (photo) => photo.id, maxLength: 80 }),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 80 }),
        (photos, selected) => {
          const counts = derivePhotoPageCounts({
            photos,
            selected,
            photosPage: { totalCount: photos.length + 10 },
          });
          expect(counts.selectedLoadedCount).toBeLessThanOrEqual(counts.loadedCount);
          expect(counts.loadedCount).toBeLessThanOrEqual(counts.totalCount);
        }
      )
    );
  });

  it('detects persisted state that accidentally includes full photo arrays', () => {
    fc.assert(
      fc.property(fc.array(photoArbitrary, { maxLength: 20 }), (photos) => {
        expect(persistedShareStateIncludesPhotos({ token: 'share', photos })).toBe(true);
        expect(persistedShareStateIncludesPhotos({ token: 'share', selected: photos.map((photo) => photo.id) })).toBe(false);
      })
    );
  });
});
