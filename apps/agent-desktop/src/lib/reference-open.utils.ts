const WINDOWS_ABSOLUTE_PATH_RE = /^[A-Za-z]:[\\/]/;

export function isAbsoluteOrHomePath(path: string): boolean {
  return (
    path.startsWith('/') ||
    path.startsWith('~') ||
    path.startsWith('\\\\') ||
    WINDOWS_ABSOLUTE_PATH_RE.test(path)
  );
}

export function resolveReferencePath(referencePath: string, workingDir: string): string {
  if (isAbsoluteOrHomePath(referencePath) || !workingDir) {
    return referencePath;
  }

  const base = workingDir.replace(/[\\/]+$/, '');
  const relative = referencePath.replace(/^[\\/]+/, '');
  return `${base}/${relative}`;
}

export function shellQuote(value: string): string {
  if (value === '~') {
    return value;
  }

  if (value.startsWith('~/')) {
    return `~/${quoteSingle(value.slice(2))}`;
  }

  return quoteSingle(value);
}

export function buildOpenReferenceCommand(referencePath: string, workingDir: string): string {
  return `open ${shellQuote(resolveReferencePath(referencePath, workingDir))}`;
}

function quoteSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
