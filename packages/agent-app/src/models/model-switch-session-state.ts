export const MODEL_SWITCH_SESSION_STATE_LIMIT = 64;

export function setBoundedSessionValue<Key, Value>(
  source: ReadonlyMap<Key, Value>,
  key: Key,
  value: Value,
): Map<Key, Value> {
  const next = new Map(source);
  next.delete(key);
  next.set(key, value);
  while (next.size > MODEL_SWITCH_SESSION_STATE_LIMIT) {
    const oldest = next.keys().next().value as Key | undefined;
    if (oldest === undefined) break;
    next.delete(oldest);
  }
  return next;
}

export function releaseSessionValue<Key, Value>(
  source: Map<Key, Value>,
  key: Key,
  owner: Value,
): boolean {
  if (source.get(key) !== owner) return false;
  source.delete(key);
  return true;
}
