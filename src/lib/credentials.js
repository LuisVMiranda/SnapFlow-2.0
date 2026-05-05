export const CREDENTIAL_GROUPS = ['api', 'profile'];

export function flattenCredentials(credentialsData = {}) {
  return CREDENTIAL_GROUPS.flatMap((group) => credentialsData[group] || []);
}

export function buildCredentialDrafts(credentialsData = {}) {
  return flattenCredentials(credentialsData).reduce((drafts, item) => {
    drafts[item.key] = item.sensitive ? '' : item.maskedValue || '';
    return drafts;
  }, {});
}

export function changedCredentialDrafts(credentialsData = {}, drafts = {}) {
  return flattenCredentials(credentialsData)
    .filter((credential) => {
      const value = String(drafts[credential.key] || '');
      if (!value.trim()) return false;
      return credential.sensitive || value !== String(credential.maskedValue || '');
    })
    .map((credential) => ({
      key: credential.key,
      label: credential.label,
      value: String(drafts[credential.key] || ''),
    }));
}
