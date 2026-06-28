import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringService } from './monitoring.service';

type ScheduledAlertEvaluationSummary = {
  skipped: boolean;
  enabled: boolean;
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
  skippedNotDue: number;
  notificationRetries: ScheduledAlertNotificationRetrySummary;
  alertEscalations: ScheduledAlertEscalationSummary;
};

type ScheduledAlertNotificationRetrySummary = {
  enabled: boolean;
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
  skippedSuperseded: number;
  skippedMaxAttempts: number;
};

type ScheduledAlertEscalationSummary = {
  enabled: boolean;
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
  skippedNoChannels: number;
  skippedAlreadyEscalated: number;
};

@Injectable()
export class MonitoringSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoringService: MonitoringService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.schedulerWorkerEnabled()) {
      return;
    }

    const intervalMs = this.schedulerIntervalMs();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.logger.log(`Monitoring scheduler enabled; interval=${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runOnce(now = new Date()): Promise<ScheduledAlertEvaluationSummary> {
    const alertRulesEnabled = this.alertRuleSchedulerEnabled();
    const notificationRetriesEnabled = this.notificationRetrySchedulerEnabled();
    const alertEscalationsEnabled = this.alertEscalationSchedulerEnabled();
    if (!alertRulesEnabled && !notificationRetriesEnabled && !alertEscalationsEnabled) {
      return this.emptySummary(false, false, notificationRetriesEnabled, alertEscalationsEnabled);
    }

    if (this.running) {
      return this.emptySummary(true, true, notificationRetriesEnabled, alertEscalationsEnabled);
    }

    this.running = true;
    try {
      const summary = this.emptySummary(false, true, notificationRetriesEnabled, alertEscalationsEnabled);

      if (alertRulesEnabled) {
        const rules = await this.prisma.alertRule.findMany({
          where: {
            enabled: true,
            evaluationMode: 'schedule',
          },
          orderBy: [{ lastEvaluatedAt: 'asc' }, { updatedAt: 'asc' }],
          take: this.batchSize(),
          select: {
            id: true,
            teamId: true,
            intervalSeconds: true,
            lastEvaluatedAt: true,
          },
        });
        summary.scanned = rules.length;

        for (const rule of rules) {
          if (!this.ruleDue(rule.lastEvaluatedAt, rule.intervalSeconds, now)) {
            summary.skippedNotDue += 1;
            continue;
          }

          summary.attempted += 1;
          try {
            await this.monitoringService.evaluateRule(rule.teamId, null, rule.id, {});
            summary.completed += 1;
          } catch (error) {
            summary.failed += 1;
            this.logger.warn(
              `Scheduled alert rule evaluation failed for rule ${rule.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }

      if (notificationRetriesEnabled) {
        summary.notificationRetries = {
          enabled: true,
          ...await this.monitoringService.retryFailedNotificationDeliveries({
            now,
            batchSize: this.notificationRetryBatchSize(),
            minAgeSeconds: this.notificationRetryMinAgeSeconds(),
            maxAttempts: this.notificationRetryMaxAttempts(),
            attemptWindowMinutes: this.notificationRetryAttemptWindowMinutes(),
            userId: null,
          }),
        };
      }

      if (alertEscalationsEnabled) {
        summary.alertEscalations = {
          enabled: true,
          ...await this.monitoringService.escalateStaleAlertEvents({
            now,
            batchSize: this.alertEscalationBatchSize(),
            minAgeSeconds: this.alertEscalationMinAgeSeconds(),
            dedupeWindowMinutes: this.alertEscalationDedupeWindowMinutes(),
            severities: this.alertEscalationSeverities(),
          }),
        };
      }

      return summary;
    } finally {
      this.running = false;
    }
  }

  private ruleDue(lastEvaluatedAt: Date | null, intervalSeconds: number, now: Date) {
    if (!lastEvaluatedAt) {
      return true;
    }
    return now.getTime() - lastEvaluatedAt.getTime() >= this.safeIntervalSeconds(intervalSeconds) * 1000;
  }

  private emptySummary(
    skipped: boolean,
    enabled: boolean,
    notificationRetriesEnabled = false,
    alertEscalationsEnabled = false,
  ): ScheduledAlertEvaluationSummary {
    return {
      skipped,
      enabled,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedNotDue: 0,
      notificationRetries: this.emptyNotificationRetrySummary(notificationRetriesEnabled),
      alertEscalations: this.emptyAlertEscalationSummary(alertEscalationsEnabled),
    };
  }

  private emptyNotificationRetrySummary(enabled: boolean): ScheduledAlertNotificationRetrySummary {
    return {
      enabled,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedSuperseded: 0,
      skippedMaxAttempts: 0,
    };
  }

  private emptyAlertEscalationSummary(enabled: boolean): ScheduledAlertEscalationSummary {
    return {
      enabled,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedNoChannels: 0,
      skippedAlreadyEscalated: 0,
    };
  }

  private schedulerWorkerEnabled() {
    return this.alertRuleSchedulerEnabled() ||
      this.notificationRetrySchedulerEnabled() ||
      this.alertEscalationSchedulerEnabled();
  }

  private alertRuleSchedulerEnabled() {
    return this.configService.get('MONITORING_SCHEDULER_ENABLED', 'false') === 'true';
  }

  private notificationRetrySchedulerEnabled() {
    const value = this.configService.get('ALERT_NOTIFICATION_RETRY_SCHEDULER_ENABLED', 'false');
    return value === 'true' || value === '1' || value === true;
  }

  private alertEscalationSchedulerEnabled() {
    const value = this.configService.get('ALERT_ESCALATION_SCHEDULER_ENABLED', 'false');
    return value === 'true' || value === '1' || value === true;
  }

  private schedulerIntervalMs() {
    const seconds = Number(this.configService.get('MONITORING_SCHEDULER_INTERVAL_SECONDS', '60'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 30 ? seconds : 60;
    return safeSeconds * 1000;
  }

  private batchSize() {
    const size = Number(this.configService.get('MONITORING_SCHEDULER_BATCH_SIZE', '20'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  private notificationRetryBatchSize() {
    const size = Number(this.configService.get('ALERT_NOTIFICATION_RETRY_BATCH_SIZE', '20'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  private notificationRetryMinAgeSeconds() {
    const seconds = Number(this.configService.get('ALERT_NOTIFICATION_RETRY_MIN_AGE_SECONDS', '300'));
    return Number.isFinite(seconds) && seconds >= 60 ? Math.min(Math.floor(seconds), 24 * 60 * 60) : 300;
  }

  private notificationRetryMaxAttempts() {
    const attempts = Number(this.configService.get('ALERT_NOTIFICATION_RETRY_MAX_ATTEMPTS', '3'));
    return Number.isInteger(attempts) && attempts >= 2 ? Math.min(attempts, 20) : 3;
  }

  private notificationRetryAttemptWindowMinutes() {
    const minutes = Number(this.configService.get('ALERT_NOTIFICATION_RETRY_ATTEMPT_WINDOW_MINUTES', '60'));
    return Number.isFinite(minutes) && minutes >= 5 ? Math.min(Math.floor(minutes), 24 * 60) : 60;
  }

  private alertEscalationBatchSize() {
    const size = Number(this.configService.get('ALERT_ESCALATION_BATCH_SIZE', '20'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  private alertEscalationMinAgeSeconds() {
    const seconds = Number(this.configService.get('ALERT_ESCALATION_MIN_AGE_SECONDS', '1800'));
    return Number.isFinite(seconds) && seconds >= 60 ? Math.min(Math.floor(seconds), 7 * 24 * 60 * 60) : 1800;
  }

  private alertEscalationDedupeWindowMinutes() {
    const minutes = Number(this.configService.get('ALERT_ESCALATION_DEDUPE_WINDOW_MINUTES', '120'));
    return Number.isFinite(minutes) && minutes >= 5 ? Math.min(Math.floor(minutes), 10080) : 120;
  }

  private alertEscalationSeverities() {
    const raw = this.configService.get('ALERT_ESCALATION_SEVERITIES', 'critical');
    return String(raw).split(',').map((item) => item.trim()).filter(Boolean);
  }

  private safeIntervalSeconds(value: number) {
    return Number.isFinite(value) && value >= 30 ? value : 300;
  }
}
