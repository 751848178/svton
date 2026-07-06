import { ConfigService } from "@nestjs/config";

export function readSlsBackfillSchedulerEnabled(configService: ConfigService) {
  return (
    configService.get("LOG_CENTER_SLS_BACKFILL_SCHEDULER_ENABLED", "false") ===
    "true"
  );
}

export function readSlsBackfillSchedulerIntervalMs(
  configService: ConfigService,
) {
  const seconds = Number(
    configService.get(
      "LOG_CENTER_SLS_BACKFILL_SCHEDULER_INTERVAL_SECONDS",
      "300",
    ),
  );
  const safeSeconds = Number.isFinite(seconds) && seconds >= 60 ? seconds : 300;
  return safeSeconds * 1000;
}

export function readSlsBackfillSchedulerDryRun(configService: ConfigService) {
  return (
    configService.get("LOG_CENTER_SLS_BACKFILL_SCHEDULER_DRY_RUN", "true") !==
    "false"
  );
}

export function readSlsBackfillSchedulerScanLimit(
  configService: ConfigService,
) {
  const size = Number(
    configService.get("LOG_CENTER_SLS_BACKFILL_SCHEDULER_SCAN_LIMIT", "100"),
  );
  return Number.isInteger(size) && size > 0 ? Math.min(size, 500) : 100;
}

export function readSlsBackfillDefaultIntervalMinutes(
  configService: ConfigService,
) {
  const minutes = Number(
    configService.get("LOG_CENTER_SLS_BACKFILL_DEFAULT_INTERVAL_MINUTES", "15"),
  );
  return Number.isFinite(minutes) && minutes > 0
    ? Math.min(Math.floor(minutes), 10080)
    : 15;
}
