export function shellBraceGroupBody(statement: string): string | null {
  const trimmed = statement.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  const body = trimmed.slice(1, -1).trim().replace(/;$/, '').trim();
  return body.length > 0 ? body : null;
}
