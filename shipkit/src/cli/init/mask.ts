// Structural secret masking applied to PARSED objects before serialization and
// diff computation (M1-01). Operating on the object — not on serialized lines —
// means diff prefixes, flow-style YAML, JSON and block scalars can no longer
// leak old or new credential values through any review surface.

/** a credential NAME (tokenRef) is not a secret — it stays visible in previews */
const SECRET_KEY_RE = /token|password|secret|credential/i;
const NOT_A_SECRET_RE = /ref$/i;
export const MASK = '********';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** deep copy with every secret-looking key's value replaced; display-only */
export function maskObject<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => maskObject(v)) as unknown as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY_RE.test(k) && !NOT_A_SECRET_RE.test(k) ? MASK : maskObject(v);
    }
    return out as T;
  }
  return value;
}
