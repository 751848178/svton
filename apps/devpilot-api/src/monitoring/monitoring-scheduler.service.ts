import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MonitoringSchedulerConfigService } from "./monitoring-scheduler-config.service";
import { createScheduledAlertEvaluationSummary } from "./monitoring-scheduler-summary.utils";
import type { ScheduledAlertEvaluationSummary } from "./monitoring-scheduler.types";
import { MonitoringService } from "./monitoring.service";

@Injectable()
export class MonitoringSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MonitoringSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoringService: MonitoringService,
    private readonly schedulerConfig: MonitoringSchedulerConfigService,
  ) {}

  onModuleInit() {
    if (!this.schedulerConfig.schedulerWorkerEnabled()) {
      return;
    }

    const intervalMs = this.schedulerConfig.schedulerIntervalMs();
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
    const alertRulesEnabled = this.schedulerConfig.alertRuleSchedulerEnabled();
    const notificationRetriesEnabled =
      this.schedulerConfig.notificationRetrySchedulerEnabled();
    const alertEscalationsEnabled =
      this.schedulerConfig.alertEscalationSchedulerEnabled();
    if (
      !alertRulesEnabled &&
      !notificationRetriesEnabled &&
      !alertEscalationsEnabled
    ) {
      return createScheduledAlertEvaluationSummary(
        false,
        false,
        notificationRetriesEnabled,
        alertEscalationsEnabled,
      );
    }

    if (this.running) {
      return createScheduledAlertEvaluationSummary(
        true,
        true,
        notificationRetriesEnabled,
        alertEscalationsEnabled,
      );
    }

    this.running = true;
    try {
      const summary = createScheduledAlertEvaluationSummary(
        false,
        true,
        notificationRetriesEnabled,
        alertEscalationsEnabled,
      );

      if (alertRulesEnabled) {
        const rules = await this.prisma.alertRule.findMany({
          where: {
            enabled: true,
            evaluationMode: "schedule",
          },
          orderBy: [{ lastEvaluatedAt: "asc" }, { updatedAt: "asc" }],
          take: this.schedulerConfig.alertRuleBatchSize(),
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
            await this.monitoringService.evaluateRule(
              rule.teamId,
              null,
              rule.id,
              {},
            );
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
          ...(await this.monitoringService.retryFailedNotificationDeliveries({
            now,
            batchSize: this.schedulerConfig.notificationRetryBatchSize(),
            minAgeSeconds:
              this.schedulerConfig.notificationRetryMinAgeSeconds(),
            maxAttempts: this.schedulerConfig.notificationRetryMaxAttempts(),
            attemptWindowMinutes:
              this.schedulerConfig.notificationRetryAttemptWindowMinutes(),
            userId: null,
          })),
        };
      }

      if (alertEscalationsEnabled) {
        summary.alertEscalations = {
          enabled: true,
          ...(await this.monitoringService.escalateStaleAlertEvents({
            now,
            batchSize: this.schedulerConfig.alertEscalationBatchSize(),
            minAgeSeconds: this.schedulerConfig.alertEscalationMinAgeSeconds(),
            dedupeWindowMinutes:
              this.schedulerConfig.alertEscalationDedupeWindowMinutes(),
            severities: this.schedulerConfig.alertEscalationSeverities(),
          })),
        };
      }

      return summary;
    } finally {
      this.running = false;
    }
  }

  private ruleDue(
    lastEvaluatedAt: Date | null,
    intervalSeconds: number,
    now: Date,
  ) {
    if (!lastEvaluatedAt) {
      return true;
    }
    return (
      now.getTime() - lastEvaluatedAt.getTime() >=
      this.schedulerConfig.safeIntervalSeconds(intervalSeconds) * 1000
    );
  }
}
