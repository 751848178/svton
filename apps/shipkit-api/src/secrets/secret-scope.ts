export type SecretScope = Record<string, string | number | boolean | null>;

/** Canonical JSON avoids order-sensitive AAD and fingerprint mismatches. */
export function canonical(value: unknown): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('Unsupported secret payload');
  return sortJson(JSON.parse(encoded));
}

function sortJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(sortJson).join(',')}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${sortJson(item)}`).join(',')}}`;
}
