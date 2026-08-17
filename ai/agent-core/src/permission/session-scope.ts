const SESSION_SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

/** Validate a policy-authored, non-secret session grant identifier. */
export function validateSessionScopeKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const key = value.trim();
  return SESSION_SCOPE_PATTERN.test(key) ? key : undefined;
}
