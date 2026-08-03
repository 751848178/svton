export function normalizeProjectRepositoryIdentity(repositoryUrl?: string | null): string | null {
  if (!repositoryUrl || !repositoryUrl.trim()) return null;
  const raw = repositoryUrl.trim();
  const withoutGit = raw.replace(/\.git$/i, '');
  const sshMatch = withoutGit.match(/^git@([^:]+):(.+)$/i);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`.toLowerCase().replace(/\/+$/g, '');
  }
  try {
    const url = new URL(withoutGit);
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+$/g, '');
  } catch {
    return withoutGit.toLowerCase().replace(/\/+$/g, '');
  }
}
