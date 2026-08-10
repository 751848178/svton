export function deriveProjectName(repositoryUrl: string) {
  const normalized = repositoryUrl
    .trim()
    .replace(/[/?#]+$/, '')
    .replace(/\.git$/, '');
  const segment = normalized.split(/[/:]/).filter(Boolean).at(-1);
  return segment || 'New project';
}
