/** A display label only: the original reference is retained for inspection/copy. */
export function imageReferenceLabel(value: string): string {
  const [repository, digest] = value.split('@');
  const name = repository?.split('/').at(-1) || value;
  if (digest?.startsWith('sha256:')) return `${digest.slice(0, 19)}${digest.length > 19 ? '…' : ''}`;
  return name;
}
