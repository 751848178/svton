export function joinPosixPath(...parts: string[]): string {
  return normalizePosixPath(parts.filter(Boolean).join('/'));
}

export function resolvePosixPath(...parts: string[]): string {
  let path = '';

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part) continue;
    path = path ? `${part}/${path}` : part;
    if (part.startsWith('/')) break;
  }

  return normalizePosixPath(path);
}

function normalizePosixPath(path: string): string {
  const isAbsolute = path.startsWith('/');
  const segments: string[] = [];

  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0 && segments[segments.length - 1] !== '..') {
        segments.pop();
      } else if (!isAbsolute) {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }

  const normalized = segments.join('/');
  if (isAbsolute) return normalized ? `/${normalized}` : '/';
  return normalized || '.';
}
