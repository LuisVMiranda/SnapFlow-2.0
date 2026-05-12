import { describe, expect, it } from 'vitest';
import { buildStoredPhone, formatClientPhone, splitStoredPhone, validateClientPhone } from './phone';

describe('phone helpers', () => {
  it('keeps Brazil as the default split for legacy stored digits', () => {
    expect(splitStoredPhone('21975191926')).toEqual({
      countryCode: '55',
      localNumber: '21975191926',
      stored: '+55 21975191926',
    });
  });

  it('parses explicitly stored international numbers', () => {
    expect(splitStoredPhone('+54 1122334455')).toEqual({
      countryCode: '54',
      localNumber: '1122334455',
      stored: '+54 1122334455',
    });
  });

  it('builds a canonical stored format', () => {
    expect(buildStoredPhone({ countryCode: '54', localNumber: '11 2233-4455' })).toBe('+54 1122334455');
  });

  it('keeps the edited DDI even before the local number is complete', () => {
    expect(buildStoredPhone({ countryCode: '54', localNumber: '' })).toBe('+54');
    expect(splitStoredPhone('+54')).toEqual({
      countryCode: '54',
      localNumber: '',
      stored: '+54',
    });
  });

  it('validates a Brazilian number with the default DDI', () => {
    expect(validateClientPhone({ countryCode: '55', localNumber: '21975191926' })).toMatchObject({
      valid: true,
      normalized: '5521975191926',
      stored: '+55 21975191926',
    });
  });

  it('validates an Argentinian-style number when the DDI is editable', () => {
    expect(validateClientPhone({ countryCode: '54', localNumber: '1122334455' })).toMatchObject({
      valid: true,
      normalized: '541122334455',
      stored: '+54 1122334455',
    });
  });

  it('formats international numbers without forcing Brazilian masks', () => {
    expect(formatClientPhone('+54 1122334455')).toBe('+54 1122334455');
  });
});
