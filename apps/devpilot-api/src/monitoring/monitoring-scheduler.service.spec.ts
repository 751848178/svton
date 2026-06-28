import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringSchedulerService } from './monitoring-scheduler.service';
import { MonitoringService } from './monitoring.service';

type PrismaMock = {
  alertRule: {
    findMany: jest.Mock;
  };
};

describe('MonitoringSchedulerService', () => {
  let prisma: PrismaMock;
  let monitoringService: {
    evaluateRule: jest.Mock;
    retryFailedNotificationDeliveries: jest.Mock;
    escalateStaleAlertEvents: jest.Mock;
  };
  let config: { get: jest.Mock };
  let service: MonitoringSchedulerService;

  beforeEach(() => {
    prisma = {
      alertRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    monitoringService = {
      evaluateRule: jest.fn().mockResolvedValue({}),
      retryFailedNotificationDeliveries: jest.fn().mockResolvedValue(retrySummary()),
      escalateStaleAlertEvents: jest.fn().mockResolvedValue(escalationSummary()),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          MONITORING_SCHEDULER_ENABLED: 'true',
          MONITORING_SCHEDULER_INTERVAL_SECONDS: '60',
          MONITORING_SCHEDULER_BATCH_SIZE: '20',
          ALERT_NOTIFICATION_RETRY_SCHEDULER_ENABLED: 'false',
          ALERT_NOTIFICATION_RETRY_BATCH_SIZE: '20',
          ALERT_NOTIFICATION_RETRY_MIN_AGE_SECONDS: '300',
          ALERT_NOTIFICATION_RETRY_MAX_ATTEMPTS: '3',
          ALERT_NOTIFICATION_RETRY_ATTEMPT_WINDOW_MINUTES: '60',
          ALERT_ESCALATION_SCHEDULER_ENABLED: 'false',
          ALERT_ESCALATION_BATCH_SIZE: '20',
          ALERT_ESCALATION_MIN_AGE_SECONDS: '1800',
          ALERT_ESCALATION_DEDUPE_WINDOW_MINUTES: '120',
          ALERT_ESCALATION_SEVERITIES: 'critical',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new MonitoringSchedulerService(
      prisma as unknown as PrismaService,
      monitoringService as unknown as MonitoringService,
      config as unknown as ConfigService,
    );
  });

  it('returns disabled summary when scheduler is off', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => (
      key === 'MONITORING_SCHEDULER_ENABLED' ? 'false' : fallback
    ));

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: false,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedNotDue: 0,
      notificationRetries: retrySummary(false),
      alertEscalations: escalationSummary(false),
    });
    expect(prisma.alertRule.findMany).not.toHaveBeenCalled();
    expect(monitoringService.retryFailedNotificationDeliveries).not.toHaveBeenCalled();
    expect(monitoringService.escalateStaleAlertEvents).not.toHaveBeenCalled();
  });

  it('evaluates due scheduled rules as system actor', async () => {
    prisma.alertRule.findMany.mockResolvedValue([
      scheduledRule('rule-1', 'team-1', null, 300),
      scheduledRule('rule-2', 'team-2', '2026-06-27T11:50:00.000Z', 300),
      scheduledRule('rule-3', 'team-2', '2026-06-27T11:59:00.000Z', 300),
    ]);

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 3,
      attempted: 2,
      completed: 2,
      failed: 0,
      skippedNotDue: 1,
      notificationRetries: retrySummary(false),
      alertEscalations: escalationSummary(false),
    });
    expect(prisma.alertRule.findMany).toHaveBeenCalledWith({
      where: {
        enabled: true,
        evaluationMode: 'schedule',
      },
      orderBy: [{ lastEvaluatedAt: 'asc' }, { updatedAt: 'asc' }],
      take: 20,
      select: {
        id: true,
        teamId: true,
        intervalSeconds: true,
        lastEvaluatedAt: true,
      },
    });
    expect(monitoringService.evaluateRule).toHaveBeenNthCalledWith(1, 'team-1', null, 'rule-1', {});
    expect(monitoringService.evaluateRule).toHaveBeenNthCalledWith(2, 'team-2', null, 'rule-2', {});
    expect(monitoringService.retryFailedNotificationDeliveries).not.toHaveBeenCalled();
    expect(monitoringService.escalateStaleAlertEvents).not.toHaveBeenCalled();
  });

  it('continues after one scheduled rule evaluation fails', async () => {
    prisma.alertRule.findMany.mockResolvedValue([
      scheduledRule('rule-1', 'team-1', null, 300),
      scheduledRule('rule-2', 'team-1', null, 300),
    ]);
    monitoringService.evaluateRule
      .mockRejectedValueOnce(new Error('evaluation failed'))
      .mockResolvedValueOnce({});

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 2,
      attempted: 2,
      completed: 1,
      failed: 1,
      skippedNotDue: 0,
      notificationRetries: retrySummary(false),
      alertEscalations: escalationSummary(false),
    });
  });

  it('can run notification retries when rule scheduling is disabled', async () => {
    const now = new Date('2026-06-27T12:00:00.000Z');
    config.get.mockImplementation((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        MONITORING_SCHEDULER_ENABLED: 'false',
        MONITORING_SCHEDULER_INTERVAL_SECONDS: '60',
        MONITORING_SCHEDULER_BATCH_SIZE: '20',
        ALERT_NOTIFICATION_RETRY_SCHEDULER_ENABLED: 'true',
        ALERT_NOTIFICATION_RETRY_BATCH_SIZE: '5',
        ALERT_NOTIFICATION_RETRY_MIN_AGE_SECONDS: '120',
        ALERT_NOTIFICATION_RETRY_MAX_ATTEMPTS: '4',
        ALERT_NOTIFICATION_RETRY_ATTEMPT_WINDOW_MINUTES: '30',
        ALERT_ESCALATION_SCHEDULER_ENABLED: 'false',
      };
      return values[key] ?? fallback;
    });
    monitoringService.retryFailedNotificationDeliveries.mockResolvedValue(retrySummary(true, {
      scanned: 2,
      attempted: 1,
      completed: 1,
      skippedSuperseded: 1,
    }));

    await expect(service.runOnce(now)).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedNotDue: 0,
      notificationRetries: retrySummary(true, {
        scanned: 2,
        attempted: 1,
        completed: 1,
        skippedSuperseded: 1,
      }),
      alertEscalations: escalationSummary(false),
    });
    expect(prisma.alertRule.findMany).not.toHaveBeenCalled();
    expect(monitoringService.retryFailedNotificationDeliveries).toHaveBeenCalledWith({
      now,
      batchSize: 5,
      minAgeSeconds: 120,
      maxAttempts: 4,
      attemptWindowMinutes: 30,
      userId: null,
    });
    expect(monitoringService.escalateStaleAlertEvents).not.toHaveBeenCalled();
  });

  it('can run alert escalations when rule scheduling is disabled', async () => {
    const now = new Date('2026-06-27T12:00:00.000Z');
    config.get.mockImplementation((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        MONITORING_SCHEDULER_ENABLED: 'false',
        MONITORING_SCHEDULER_INTERVAL_SECONDS: '60',
        MONITORING_SCHEDULER_BATCH_SIZE: '20',
        ALERT_NOTIFICATION_RETRY_SCHEDULER_ENABLED: 'false',
        ALERT_ESCALATION_SCHEDULER_ENABLED: 'true',
        ALERT_ESCALATION_BATCH_SIZE: '7',
        ALERT_ESCALATION_MIN_AGE_SECONDS: '900',
        ALERT_ESCALATION_DEDUPE_WINDOW_MINUTES: '45',
        ALERT_ESCALATION_SEVERITIES: 'critical,warning',
      };
      return values[key] ?? fallback;
    });
    monitoringService.escalateStaleAlertEvents.mockResolvedValue(escalationSummary(true, {
      scanned: 3,
      attempted: 2,
      completed: 2,
      skippedAlreadyEscalated: 1,
    }));

    await expect(service.runOnce(now)).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedNotDue: 0,
      notificationRetries: retrySummary(false),
      alertEscalations: escalationSummary(true, {
        scanned: 3,
        attempted: 2,
        completed: 2,
        skippedAlreadyEscalated: 1,
      }),
    });
    expect(prisma.alertRule.findMany).not.toHaveBeenCalled();
    expect(monitoringService.retryFailedNotificationDeliveries).not.toHaveBeenCalled();
    expect(monitoringService.escalateStaleAlertEvents).toHaveBeenCalledWith({
      now,
      batchSize: 7,
      minAgeSeconds: 900,
      dedupeWindowMinutes: 45,
      severities: ['critical', 'warning'],
    });
  });

  it('returns skipped summary when a scheduler tick is already running', async () => {
    prisma.alertRule.findMany.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve([]), 10);
    }));

    const first = service.runOnce(new Date('2026-06-27T12:00:00.000Z'));
    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: true,
      enabled: true,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedNotDue: 0,
      notificationRetries: retrySummary(false),
      alertEscalations: escalationSummary(false),
    });
    await first;
  });
});

function scheduledRule(
  id: string,
  teamId: string,
  lastEvaluatedAt: string | null,
  intervalSeconds: number,
) {
  return {
    id,
    teamId,
    intervalSeconds,
    lastEvaluatedAt: lastEvaluatedAt ? new Date(lastEvaluatedAt) : null,
  };
}

function retrySummary(
  enabled = false,
  overrides: Partial<{
    scanned: number;
    attempted: number;
    completed: number;
    failed: number;
    skippedSuperseded: number;
    skippedMaxAttempts: number;
  }> = {},
) {
  return {
    enabled,
    scanned: 0,
    attempted: 0,
    completed: 0,
    failed: 0,
    skippedSuperseded: 0,
    skippedMaxAttempts: 0,
    ...overrides,
  };
}

function escalationSummary(
  enabled = false,
  overrides: Partial<{
    scanned: number;
    attempted: number;
    completed: number;
    failed: number;
    skippedNoChannels: number;
    skippedAlreadyEscalated: number;
  }> = {},
) {
  return {
    enabled,
    scanned: 0,
    attempted: 0,
    completed: 0,
    failed: 0,
    skippedNoChannels: 0,
    skippedAlreadyEscalated: 0,
    ...overrides,
  };
}
