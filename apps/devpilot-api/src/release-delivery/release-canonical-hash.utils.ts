import { createHash } from "node:crypto";

export function hashCanonicalReleaseValue(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeReleaseValue(value)))
    .digest("hex");
}

export function canonicalizeReleaseValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalizeReleaseValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeReleaseValue(entry)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
