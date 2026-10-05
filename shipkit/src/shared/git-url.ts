// Public Git provenance/log metadata must never carry URL user information.
// Callers keep the original URL separately for authenticated transport.
export function publicGitRepoUrl(repo: string): string {
  try {
    const url = new URL(repo);
    if (!url.username && !url.password) return repo;
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    // Even a malformed URL must not leak its authority credentials in logs.
    return repo.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i, '$1');
  }
}
