import type { Prisma } from "@prisma/client";

export function matchesStringList(
  value: Prisma.JsonValue | null,
  needle?: string,
) {
  if (!needle) return true;
  const list = readStringList(value);
  return (
    list.length === 0 || list.some((pattern) => matchesPattern(pattern, needle))
  );
}

export function cleanStringList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function readStringList(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return cleanStringList(
    value.filter((item): item is string => typeof item === "string"),
  );
}

function matchesPattern(pattern: string, needle: string) {
  if (pattern === "*") return true;
  if (pattern === needle) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -1);
    return needle.startsWith(prefix);
  }
  return false;
}
