import { ConfigService } from "@nestjs/config";

export function readServerFollowSchedulerEnabled(configService: ConfigService) {
  return (
    configService.get("LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED", "false") ===
    "true"
  );
}

export function readServerFollowSchedulerIntervalMs(
  configService: ConfigService,
) {
  const seconds = Number(
    configService.get(
      "LOG_CENTER_SERVER_FOLLOW_SCHEDULER_INTERVAL_SECONDS",
      "300",
    ),
  );
  const safeSeconds = Number.isFinite(seconds) && seconds >= 60 ? seconds : 300;
  return safeSeconds * 1000;
}

export function readServerFollowSchedulerDryRun(configService: ConfigService) {
  return (
    configService.get("LOG_CENTER_SERVER_FOLLOW_SCHEDULER_DRY_RUN", "true") !==
    "false"
  );
}

export function readServerFollowSchedulerScanLimit(
  configService: ConfigService,
) {
  const size = Number(
    configService.get("LOG_CENTER_SERVER_FOLLOW_SCHEDULER_SCAN_LIMIT", "100"),
  );
  return Number.isInteger(size) && size > 0 ? Math.min(size, 500) : 100;
}

export function readServerFollowDefaultIntervalMinutes(
  configService: ConfigService,
) {
  const minutes = Number(
    configService.get("LOG_CENTER_SERVER_FOLLOW_DEFAULT_INTERVAL_MINUTES", "5"),
  );
  return Number.isFinite(minutes) && minutes > 0
    ? Math.min(Math.floor(minutes), 10080)
    : 5;
}
