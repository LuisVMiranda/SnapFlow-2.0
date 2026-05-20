import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { changedCredentialDrafts } from './credentials';

const keyArbitrary = fc.string({ minLength: 1, maxLength: 12 }).filter((value) => /^[a-zA-Z0-9_]+$/.test(value));

describe('changedCredentialDrafts properties', () => {
  it('submits changed non-empty fields once and never submits unchanged fields', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            key: keyArbitrary,
            maskedValue: fc.string({ maxLength: 10 }),
            sensitive: fc.boolean(),
          }),
          { selector: (credential) => credential.key, maxLength: 12 }
        ),
        fc.dictionary(keyArbitrary, fc.string({ maxLength: 12 })),
        (credentials, randomDrafts) => {
          const data = {
            api: credentials.slice(0, Math.ceil(credentials.length / 2)).map((credential) => ({
              ...credential,
              label: credential.key,
            })),
            profile: credentials.slice(Math.ceil(credentials.length / 2)).map((credential) => ({
              ...credential,
              label: credential.key,
            })),
          };
          const drafts = Object.fromEntries(
            credentials.map((credential) => [
              credential.key,
              randomDrafts[credential.key] ? (credential.sensitive ? '' : credential.maskedValue) : '',
            ])
          );

          const changes = changedCredentialDrafts(data, drafts);
          const keys = changes.map((change) => change.key);
          expect(new Set(keys).size).toBe(keys.length);

          for (const credential of credentials) {
            const draft = String(drafts[credential.key] || '');
            const shouldSubmit = draft.trim() && (credential.sensitive || draft !== String(credential.maskedValue || ''));
            expect(keys.includes(credential.key)).toBe(Boolean(shouldSubmit));
          }
        }
      )
    );
  });
});
