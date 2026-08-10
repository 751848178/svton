const STORAGE_KEY = "devpilot.generated-project.attempt";

interface StoredAttempt {
  fingerprint: string;
  key: string;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function readAttempt(storage: Pick<Storage, "getItem">): StoredAttempt | null {
  try {
    const value = storage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<StoredAttempt>;
    return typeof parsed.fingerprint === "string" && typeof parsed.key === "string"
      ? { fingerprint: parsed.fingerprint, key: parsed.key }
      : null;
  } catch {
    return null;
  }
}

export function getGeneratedProjectAttempt(
  storage: Pick<Storage, "getItem" | "setItem">,
  randomUUID: () => string,
  payload: unknown,
): StoredAttempt {
  const fingerprint = stableJson(payload);
  const stored = readAttempt(storage);
  if (stored?.fingerprint === fingerprint) return stored;
  const attempt = { fingerprint, key: randomUUID() };
  storage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  return attempt;
}

export function clearGeneratedProjectAttempt(
  storage: Pick<Storage, "getItem" | "removeItem">,
  key: string,
): void {
  if (readAttempt(storage)?.key === key) storage.removeItem(STORAGE_KEY);
}
