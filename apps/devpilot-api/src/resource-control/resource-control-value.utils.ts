export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function asOptionalRecord(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

export function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function asPositiveInt(value: unknown, fallback: number, max: number) {
  const rawValue = typeof value === 'string' ? Number(value) : value;
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.floor(rawValue), max));
}
