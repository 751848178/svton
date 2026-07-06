import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`Server executor 快照缺少 ${field}`);
  }
  return value;
}

export function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : true;
}

export function readOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function readOptionalIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function readPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

export function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
