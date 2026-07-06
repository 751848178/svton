import { SlsBackfillConfig } from "./log-sls-backfill-scheduler.types";

export function readSlsBackfillConfig(
  metadata: unknown,
  defaultIntervalMinutes: number,
): SlsBackfillConfig {
  const record = asRecord(metadata);
  const raw = hasRecord(record.slsBackfill)
    ? asRecord(record.slsBackfill)
    : asRecord(record.slsCollection);
  return {
    enabled: raw.enabled === true,
    live: raw.live === true,
    confirmLiveRead: raw.confirmLiveRead === true,
    query: asString(raw.query) || "*",
    windowMinutes: asPositiveInt(raw.windowMinutes, 15, 1440),
    limit: asPositiveInt(raw.limit, 100, 1000),
    intervalMinutes: asPositiveInt(
      raw.intervalMinutes,
      defaultIntervalMinutes,
      10080,
    ),
  };
}

export function buildSlsBackfillParams(
  config: SlsBackfillConfig,
  logstore: string | undefined,
  confirmLiveRead: boolean,
) {
  return {
    query: config.query,
    windowMinutes: config.windowMinutes,
    limit: config.limit,
    logstore,
    confirmLiveRead,
    scheduledBackfill: true,
  };
}

function asPositiveInt(value: unknown, fallback: number, max: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function hasRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
