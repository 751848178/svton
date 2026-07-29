/** Browser-safe subset of node:path.posix used by the Desktop agent runtime. */
export function join(...parts: string[]): string {
  const joined = parts.filter(Boolean).join('/');
  return normalizePosixPath(joined || '.');
}

export function resolve(...parts: string[]): string {
  let combined = '';
  let absolute = false;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part) continue;
    combined = combined ? `${part}/${combined}` : part;
    if (part.startsWith('/')) {
      absolute = true;
      break;
    }
  }
  return normalizePosixPath(`${absolute ? '' : '/'}${combined}`);
}

export const posix = { join, resolve };
export default { posix, join, resolve };

function normalizePosixPath(input: string): string {
  const absolute = input.startsWith('/');
  const segments: string[] = [];
  for (const segment of input.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0 && segments.at(-1) !== '..') segments.pop();
      else if (!absolute) segments.push('..');
      continue;
    }
    segments.push(segment);
  }
  const normalized = segments.join('/');
  if (absolute) return `/${normalized}`;
  return normalized || '.';
}
