import { describe, expect, it } from 'vitest';
import { buildAdminApprovalUrl, readAdminApprovalSessionId } from './adminApproval';

describe('admin approval routing helpers', () => {
  it('builds the focused approval URL as a query parameter', () => {
    expect(buildAdminApprovalUrl('sess_123', 'https://snapflow.test')).toBe('https://snapflow.test/?adminApproval=sess_123');
  });

  it('reads the approval session from the current query parameter', () => {
    const location = { pathname: '/', search: '?adminApproval=sess_abc' };

    expect(readAdminApprovalSessionId(location)).toBe('sess_abc');
  });

  it('keeps compatibility with old approval URLs generated as a path', () => {
    const location = { pathname: '/adminApproval=sess_legacy%201', search: '' };

    expect(readAdminApprovalSessionId(location)).toBe('sess_legacy 1');
  });

  it('keeps compatibility with slash-style approval URLs', () => {
    const location = { pathname: '/adminApproval/sess_path', search: '' };

    expect(readAdminApprovalSessionId(location)).toBe('sess_path');
  });
});
