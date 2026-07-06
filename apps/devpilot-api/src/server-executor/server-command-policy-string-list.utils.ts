import { Prisma } from "@prisma/client";

export function matchesStringList(
  value: Prisma.JsonValue | null,
  needle?: string,
) {
  if (!needle) return true;
  const list = readStringList(value);
  return list.length === 0 || list.includes(needle);
}

export function toStringListJson(
  values?: string[] | null,
): Prisma.InputJsonValue {
  return cleanStringList(values);
}

export function cleanStringList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export function readStringList(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return cleanStringList(
    value.filter((item): item is string => typeof item === "string"),
  );
}
