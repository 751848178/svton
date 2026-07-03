import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MonitoringSchedulerConfigService {
  constructor(private readonly configService: ConfigService) {}

  schedulerWorkerEnabled() {
    return (
      this.alertRuleSchedulerEnabled() ||
      this.notificationRetrySchedulerEnabled() ||
      this.alertEscalationSchedulerEnabled()
    );
  }

  alertRuleSchedulerEnabled() {
    return (
      this.configService.get("MONITORING_SCHEDULER_ENABLED", "false") === "true"
    );
  }

  notificationRetrySchedulerEnabled() {
    const value = this.configService.get(
      "ALERT_NOTIFICATION_RETRY_SCHEDULER_ENABLED",
      "false",
    );
    return value === "true" || value === "1" || value === true;
  }

  alertEscalationSchedulerEnabled() {
    const value = this.configService.get(
      "ALERT_ESCALATION_SCHEDULER_ENABLED",
      "false",
    );
    return value === "true" || value === "1" || value === true;
  }

  schedulerIntervalMs() {
    const seconds = Number(
      this.configService.get("MONITORING_SCHEDULER_INTERVAL_SECONDS", "60"),
    );
    const safeSeconds =
      Number.isFinite(seconds) && seconds >= 30 ? seconds : 60;
    return safeSeconds * 1000;
  }

  alertRuleBatchSize() {
    const size = Number(
      this.configService.get("MONITORING_SCHEDULER_BATCH_SIZE", "20"),
    );
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  notificationRetryBatchSize() {
    const size = Number(
      this.configService.get("ALERT_NOTIFICATION_RETRY_BATCH_SIZE", "20"),
    );
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  notificationRetryMinAgeSeconds() {
    const seconds = Number(
      this.configService.get("ALERT_NOTIFICATION_RETRY_MIN_AGE_SECONDS", "300"),
    );
    return Number.isFinite(seconds) && seconds >= 60
      ? Math.min(Math.floor(seconds), 24 * 60 * 60)
      : 300;
  }

  notificationRetryMaxAttempts() {
    const attempts = Number(
      this.configService.get("ALERT_NOTIFICATION_RETRY_MAX_ATTEMPTS", "3"),
    );
    return Number.isInteger(attempts) && attempts >= 2
      ? Math.min(attempts, 20)
      : 3;
  }

  notificationRetryAttemptWindowMinutes() {
    const minutes = Number(
      this.configService.get(
        "ALERT_NOTIFICATION_RETRY_ATTEMPT_WINDOW_MINUTES",
        "60",
      ),
    );
    return Number.isFinite(minutes) && minutes >= 5
      ? Math.min(Math.floor(minutes), 24 * 60)
      : 60;
  }

  alertEscalationBatchSize() {
    const size = Number(
      this.configService.get("ALERT_ESCALATION_BATCH_SIZE", "20"),
    );
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  alertEscalationMinAgeSeconds() {
    const seconds = Number(
      this.configService.get("ALERT_ESCALATION_MIN_AGE_SECONDS", "1800"),
    );
    return Number.isFinite(seconds) && seconds >= 60
      ? Math.min(Math.floor(seconds), 7 * 24 * 60 * 60)
      : 1800;
  }

  alertEscalationDedupeWindowMinutes() {
    const minutes = Number(
      this.configService.get("ALERT_ESCALATION_DEDUPE_WINDOW_MINUTES", "120"),
    );
    return Number.isFinite(minutes) && minutes >= 5
      ? Math.min(Math.floor(minutes), 10080)
      : 120;
  }

  alertEscalationSeverities() {
    const raw = this.configService.get(
      "ALERT_ESCALATION_SEVERITIES",
      "critical",
    );
    return String(raw)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  safeIntervalSeconds(value: number) {
    return Number.isFinite(value) && value >= 30 ? value : 300;
  }
}
