import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export function normalizeLogTail(tail?: number) {
  if (!tail || Number.isNaN(tail)) return 200;
  return Math.max(1, Math.min(Math.floor(tail), 5000));
}

export function normalizeTailEntryLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return 100;
  return Math.max(1, Math.min(Math.floor(limit), 500));
}

export function parseTailCursor(cursor?: string) {
  if (!cursor) return null;
  const [timestampValue, createdAtValue, id] = cursor.split("|");
  const timestamp = new Date(timestampValue);
  const createdAt = new Date(createdAtValue);
  if (
    !timestampValue ||
    !createdAtValue ||
    !id ||
    Number.isNaN(timestamp.getTime()) ||
    Number.isNaN(createdAt.getTime())
  ) {
    throw new BadRequestException("日志 tail cursor 无效");
  }
  return { timestamp, createdAt, id };
}

export function buildTailCursor(timestamp: Date, createdAt: Date, id: string) {
  return `${timestamp.toISOString()}|${createdAt.toISOString()}|${id}`;
}

export function isServerCollectableSource(sourceType: string) {
  return ["docker", "nginx", "server_executor"].includes(sourceType);
}

export function normalizeVarLogPath(value?: string | null, namespace?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  const prefix = namespace ? `/var/log/${namespace}/` : "/var/log/";
  if (!trimmed.startsWith(prefix)) return null;
  if (trimmed.includes("..")) return null;
  if (!/^[a-zA-Z0-9_./@-]+\.log$/.test(trimmed)) return null;
  return trimmed;
}

export function firstCommandToken(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (/^[a-zA-Z0-9_.:/@-]+$/.test(trimmed)) return trimmed;
  }
  return null;
}

export function readString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => readString(item))
    .filter((item): item is string => Boolean(item));
}

export function positiveInt(value: unknown, fallback: number, max: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

export function isLiveSlsQueryConfirmed(params: Record<string, unknown>) {
  return params.confirmLiveRead === true;
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
