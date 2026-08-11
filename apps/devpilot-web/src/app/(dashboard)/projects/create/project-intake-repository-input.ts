import type { ProjectIntakeForm } from './types';

export function projectIntakeCredentialReady(form: ProjectIntakeForm) {
  if (form.visibility === 'public') return true;
  if (form.credentialMode === 'managed') return Boolean(form.teamCredentialId.trim());
  return Boolean(form.credentialName.trim() && form.credentialSecret);
}

export function projectIntakeRepositoryInput(form: ProjectIntakeForm) {
  const base = {
    repositoryUrl: form.repositoryUrl.trim(),
    branch: form.branch.trim() || undefined,
  };
  if (form.visibility === 'public') return { ...base, visibility: 'public' as const };
  if (form.credentialMode === 'managed') {
    const teamCredentialId = form.teamCredentialId.trim();
    if (!teamCredentialId) throw new Error('PRIVATE_REPOSITORY_CREDENTIAL_REQUIRED');
    return { ...base, visibility: 'private' as const, teamCredentialId };
  }
  const name = form.credentialName.trim();
  if (!name || !form.credentialSecret)
    throw new Error('PRIVATE_REPOSITORY_CREDENTIAL_REQUIRED');
  return { ...base, visibility: 'private' as const, credential: {
    type: form.credentialType, name,
    username: form.credentialUsername.trim() || undefined,
    secret: form.credentialSecret,
  } };
}
