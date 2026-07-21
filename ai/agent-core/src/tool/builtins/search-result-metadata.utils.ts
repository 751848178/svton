export function grepRequestMetadata(
  pattern: string,
  path: string,
  includePattern: string | undefined,
  ignoreCase: boolean,
  maxResults: number,
): Record<string, unknown> {
  return {
    pattern,
    path,
    ...(includePattern ? { includePattern } : {}),
    ignoreCase,
    maxResults,
  };
}

export function globRequestMetadata(pattern: string, path: string): Record<string, unknown> {
  return { pattern, path };
}

export function formatGrepResults(results: unknown[]): string {
  return results.map(formatGrepResult).join('\n');
}

export function formatGlobResults(files: unknown[]): string {
  return files.map(formatGlobFile).join('\n');
}

function formatGrepResult(result: unknown): string {
  if (!result || typeof result !== 'object') {
    throw new Error('Search backend returned invalid grep result.');
  }
  const record = result as Record<string, unknown>;
  if (typeof record.file !== 'string' || record.file.trim().length === 0) {
    throw new Error('Search backend returned invalid grep result file.');
  }
  if (typeof record.line !== 'number' || !Number.isInteger(record.line) || record.line < 1) {
    throw new Error('Search backend returned invalid grep result line.');
  }
  if (typeof record.text !== 'string') {
    throw new Error('Search backend returned invalid grep result text.');
  }
  return `${record.file}:${record.line}: ${record.text}`;
}

function formatGlobFile(file: unknown): string {
  if (typeof file !== 'string' || file.trim().length === 0) {
    throw new Error('Search backend returned invalid glob result file.');
  }
  return file;
}
