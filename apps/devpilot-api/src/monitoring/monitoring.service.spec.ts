import { ConfigService } from '@nestjs/config';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringAlertEscalationAuditService } from './monitoring-alert-escalation-audit.service';
import { MonitoringAlertEscalationService } from './monitoring-alert-escalation.service';
import { MonitoringAlertSilenceMatcherService } from './monitoring-alert-silence-matcher.service';
import { MonitoringAlertSilenceWindowService } from './monitoring-alert-silence-window.service';
import { MonitoringAlertSilenceService } from './monitoring-alert-silence.service';
import { MonitoringNotificationChannelSettingsService } from './monitoring-notification-channel-settings.service';
import { MonitoringNotificationChannelService } from './monitoring-notification-channel.service';
import { MonitoringNotificationDeliveryConfigService } from './monitoring-notification-delivery-config.service';
import { MonitoringNotificationDeliveryDispatchService } from './monitoring-notification-delivery-dispatch.service';
import { MonitoringNotificationDeliveryEmailSenderService } from './monitoring-notification-delivery-email-sender.service';
import { MonitoringNotificationDeliveryEmailService } from './monitoring-notification-delivery-email.service';
import { MonitoringNotificationDeliveryPayloadService } from './monitoring-notification-delivery-payload.service';
import { MonitoringNotificationDeliveryReadService } from './monitoring-notification-delivery-read.service';
import { MonitoringNotificationDeliveryWebhookService } from './monitoring-notification-delivery-webhook.service';
import { MonitoringNotificationDeliveryWriterService } from './monitoring-notification-delivery-writer.service';
import { MonitoringNotificationRetryAuditService } from './monitoring-notification-retry-audit.service';
import { MonitoringNotificationRetryService } from './monitoring-notification-retry.service';
import { MonitoringProjectEnvironmentScopeService } from './monitoring-project-environment-scope.service';
import { MonitoringResourceMetricDashboardBuilderService } from './monitoring-resource-metric-dashboard-builder.service';
import { MonitoringResourceMetricDashboardService } from './monitoring-resource-metric-dashboard.service';
import { MonitoringServiceSloDashboardBuilderService } from './monitoring-service-slo-dashboard-builder.service';
import { MonitoringServiceSloDashboardService } from './monitoring-service-slo-dashboard.service';
import { MonitoringServiceSloDashboardStatusService } from './monitoring-service-slo-dashboard-status.service';
import { MonitoringService } from './monitoring.service';

type PrismaMock = {
  alertRule: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  alertEvent: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
  applicationService: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  deploymentRun: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  applicationServiceOperationRun: {
    findMany: jest.Mock;
  };
  alertSilence: {
    findMany: jest.Mock;
  };
  alertNotificationChannel: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  alertNotificationDelivery: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
  resourceSyncRun: {
    findMany: jest.Mock;
  };
  resourceMetricSnapshot: {
    findMany: jest.Mock;
  };
  siteSyncRun: {
    findMany: jest.Mock;
  };
  logEntry: {
    count: jest.Mock;
    groupBy: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('MonitoringService cloud provider sync alerts', () => {
  let prisma: PrismaMock;
  let auditEventService: { create: jest.Mock };
  let configService: { get: jest.Mock };
  let alertEscalationAuditService: MonitoringAlertEscalationAuditService;
  let alertEscalationService: MonitoringAlertEscalationService;
  let alertSilenceService: MonitoringAlertSilenceService;
  let notificationChannelSettingsService: MonitoringNotificationChannelSettingsService;
  let notificationChannelService: MonitoringNotificationChannelService;
  let notificationDeliveryReadService: MonitoringNotificationDeliveryReadService;
  let notificationDeliveryConfigService: MonitoringNotificationDeliveryConfigService;
  let notificationDeliveryDispatchService: MonitoringNotificationDeliveryDispatchService;
  let notificationDeliveryPayloadService: MonitoringNotificationDeliveryPayloadService;
  let notificationRetryAuditService: MonitoringNotificationRetryAuditService;
  let notificationRetryService: MonitoringNotificationRetryService;
  let resourceMetricDashboardService: MonitoringResourceMetricDashboardService;
  let projectEnvironmentScopeService: MonitoringProjectEnvironmentScopeService;
  let serviceSloDashboardService: MonitoringServiceSloDashboardService;
  let service: MonitoringService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-27T00:00:00.000Z'));
    prisma = {
      alertRule: {
        findFirst: jest.fn(),
        update: jest.fn((args) => Promise.resolve({
          ...baseRule(),
          lastStatus: args.data.lastStatus,
          lastMessage: args.data.lastMessage,
          lastEvaluatedAt: args.data.lastEvaluatedAt,
        })),
      },
      alertEvent: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn((args) => Promise.resolve({
          id: 'event-1',
          category: args.data.category,
          metric: args.data.metric,
          severity: args.data.severity,
          status: args.data.status,
          summary: args.data.summary,
          metadata: args.data.metadata,
          projectId: args.data.projectId,
          environmentId: args.data.environmentId,
          applicationId: args.data.applicationId,
          applicationServiceId: args.data.applicationServiceId,
          serverId: args.data.serverId,
          siteId: args.data.siteId,
          managedResourceId: args.data.managedResourceId,
          backupPlanId: args.data.backupPlanId,
          occurredAt: new Date('2026-06-26T12:10:00.000Z'),
          project: { id: args.data.projectId, name: '项目 A' },
          environment: { id: args.data.environmentId, key: 'prod', name: '生产', status: 'active' },
          rule: {
            id: args.data.ruleId,
            name: '云同步失败',
            metric: args.data.metric,
            severity: args.data.severity,
            enabled: true,
          },
        })),
      },
      applicationService: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      deploymentRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      applicationServiceOperationRun: {
        findMany: jest.fn(),
      },
      alertSilence: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      alertNotificationChannel: {
        create: jest.fn((args) => Promise.resolve({
          id: 'channel-new',
          createdAt: new Date('2026-06-27T00:00:00.000Z'),
          updatedAt: new Date('2026-06-27T00:00:00.000Z'),
          createdBy: { id: args.data.createdById, name: 'Owner', email: 'owner@example.test' },
          ...args.data,
        })),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      alertNotificationDelivery: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn((args) => Promise.resolve({
          id: 'delivery-new',
          ...args.data,
          createdAt: new Date('2026-06-27T00:00:00.000Z'),
          channel: {
            id: args.data.channelId,
            name: '运维 Webhook',
            type: args.data.channelType,
            status: 'active',
            projectId: 'project-1',
            environmentId: 'env-prod',
            config: { target: args.data.target },
          },
          alertEvent: {
            id: args.data.alertEventId,
            projectId: 'project-1',
            environmentId: 'env-prod',
            category: 'resource',
            metric: 'cloud_provider_sync_failure',
            severity: 'warning',
            status: 'firing',
            summary: '云同步失败',
            occurredAt: new Date('2026-06-26T12:10:00.000Z'),
            rule: { id: 'rule-1', name: '云同步失败' },
          },
        })),
      },
      resourceSyncRun: {
        findMany: jest.fn(),
      },
      resourceMetricSnapshot: {
        findMany: jest.fn(),
      },
      siteSyncRun: {
        findMany: jest.fn(),
      },
      logEntry: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
    };
    auditEventService = { create: jest.fn().mockResolvedValue({}) };
    configService = {
      get: jest.fn((key: string, fallback: unknown) => fallback),
    };
    projectEnvironmentScopeService = new MonitoringProjectEnvironmentScopeService(
      prisma as unknown as PrismaService,
    );
    alertSilenceService = new MonitoringAlertSilenceService(
      prisma as unknown as PrismaService,
      projectEnvironmentScopeService,
      new MonitoringAlertSilenceWindowService(),
      new MonitoringAlertSilenceMatcherService(
        prisma as unknown as PrismaService,
      ),
    );
    notificationDeliveryReadService = new MonitoringNotificationDeliveryReadService(
      prisma as unknown as PrismaService,
    );
    notificationDeliveryConfigService = new MonitoringNotificationDeliveryConfigService(
      configService as unknown as ConfigService,
    );
    notificationChannelSettingsService = new MonitoringNotificationChannelSettingsService(
      notificationDeliveryConfigService,
    );
    notificationChannelService = new MonitoringNotificationChannelService(
      prisma as unknown as PrismaService,
      notificationChannelSettingsService,
      projectEnvironmentScopeService,
    );
    notificationDeliveryPayloadService = new MonitoringNotificationDeliveryPayloadService();
    const notificationDeliveryWriterService = new MonitoringNotificationDeliveryWriterService(
      prisma as unknown as PrismaService,
    );
    const notificationDeliveryWebhookService = new MonitoringNotificationDeliveryWebhookService(
      notificationDeliveryConfigService,
      notificationDeliveryPayloadService,
      notificationDeliveryWriterService,
    );
    const notificationDeliveryEmailService = new MonitoringNotificationDeliveryEmailService(
      notificationDeliveryConfigService,
      new MonitoringNotificationDeliveryEmailSenderService(),
      notificationDeliveryPayloadService,
      notificationDeliveryWriterService,
    );
    notificationDeliveryDispatchService = new MonitoringNotificationDeliveryDispatchService(
      prisma as unknown as PrismaService,
      notificationDeliveryEmailService,
      notificationDeliveryWebhookService,
    );
    notificationRetryAuditService = new MonitoringNotificationRetryAuditService(
      auditEventService as unknown as AuditEventService,
    );
    notificationRetryService = new MonitoringNotificationRetryService(
      prisma as unknown as PrismaService,
      notificationRetryAuditService,
      notificationDeliveryDispatchService,
    );
    alertEscalationAuditService = new MonitoringAlertEscalationAuditService(
      auditEventService as unknown as AuditEventService,
    );
    alertEscalationService = new MonitoringAlertEscalationService(
      prisma as unknown as PrismaService,
      alertEscalationAuditService,
      notificationDeliveryDispatchService,
    );
    resourceMetricDashboardService = new MonitoringResourceMetricDashboardService(
      prisma as unknown as PrismaService,
      new MonitoringResourceMetricDashboardBuilderService(),
    );
    serviceSloDashboardService = new MonitoringServiceSloDashboardService(
      prisma as unknown as PrismaService,
      new MonitoringServiceSloDashboardBuilderService(
        new MonitoringServiceSloDashboardStatusService(),
      ),
    );
    service = new MonitoringService(
      prisma as unknown as PrismaService,
      auditEventService as unknown as AuditEventService,
      configService as unknown as ConfigService,
      resourceMetricDashboardService,
      serviceSloDashboardService,
      alertSilenceService,
      notificationDeliveryReadService,
      notificationChannelService,
      notificationDeliveryDispatchService,
      notificationRetryService,
      alertEscalationService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns stable immutable service SLO rule templates', () => {
    const templates = service.listServiceSloRuleTemplates();

    expect(templates).toHaveLength(4);
    expect(templates.map((template) => template.id)).toEqual([
      'standard_api_availability',
      'high_reliability_burn_rate',
      'error_budget_guardrail',
      'error_budget_exhaustion_forecast',
    ]);
    expect(templates[0]).toEqual(expect.objectContaining({
      targetType: 'service_slo',
      metric: 'service_slo_breach',
      severity: 'warning',
      evaluationMode: 'schedule',
      condition: expect.objectContaining({
        strategy: 'single_window',
        windowMinutes: 1440,
        targetPercent: 99,
        burnRateThreshold: 1,
      }),
    }));

    const highReliability = templates.find((template) => template.id === 'high_reliability_burn_rate');
    expect(highReliability).toEqual(expect.objectContaining({
      severity: 'critical',
      condition: expect.objectContaining({
        strategy: 'multi_window_burn_rate',
        matchPolicy: 'all',
        targetPercent: 99.9,
        windows: [
          expect.objectContaining({ label: '短窗口', windowMinutes: 60, burnRateThreshold: 14 }),
          expect.objectContaining({ label: '长窗口', windowMinutes: 360, burnRateThreshold: 6 }),
        ],
      }),
    }));

    const condition = highReliability?.condition as { windows?: Array<{ windowMinutes: number }> };
    if (condition.windows) {
      condition.windows[0].windowMinutes = 1;
    }

    const refreshed = service.listServiceSloRuleTemplates()
      .find((template) => template.id === 'high_reliability_burn_rate');
    expect((refreshed?.condition as { windows?: Array<{ windowMinutes: number }> }).windows?.[0].windowMinutes).toBe(60);
    expect(templates.find((template) => template.id === 'error_budget_exhaustion_forecast')).toEqual(
      expect.objectContaining({
        targetType: 'service_error_budget_exhaustion',
        metric: 'service_error_budget_exhaustion',
        severity: 'critical',
        condition: expect.objectContaining({
          windowMinutes: 1440,
          targetPercent: 99,
          exhaustionWithinMinutes: 1440,
        }),
      }),
    );
  });

  it('fires when recent scoped cloud sync runs hit the live provider failure threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule());
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: provider timeout',
      }),
      cloudRun('run-2', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: forbidden',
      }),
      cloudRun('run-3', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_sdk_live',
        live: true,
      }),
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-1', {});

    expect(result.event?.status).toBe('firing');
    expect(result.rule.lastStatus).toBe('firing');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'firing',
        value: expect.objectContaining({
          failureCount: 2,
          configFallbackCount: 0,
          provider: 'aliyun-rds',
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('keeps configuration fallback visible without firing by default', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule());
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Cloud provider live inventory is disabled',
      }),
      cloudRun('run-2', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Cloud provider live inventory requires a TeamCredential binding',
      }),
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-1', {});

    expect(result.event?.status).toBe('resolved');
    expect(result.rule.lastStatus).toBe('ok');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        value: expect.objectContaining({
          failureCount: 0,
          configFallbackCount: 2,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('allows scheduled evaluations to write events and audits without a user actor', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule());
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: provider timeout',
      }),
      cloudRun('run-2', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: forbidden',
      }),
    ]);

    await service.evaluateRule('team-1', null, 'rule-1', {});

    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: null,
        status: 'firing',
      }),
      include: expect.any(Object),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      actorId: null,
      action: 'alert.evaluate',
      status: 'firing',
    }));
  });

  it('deduplicates repeated firing events inside the rule dedupe window', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule({
      condition: {
        provider: 'aliyun-rds',
        windowRuns: 5,
        failureThreshold: 2,
        dedupeWindowMinutes: 30,
      },
    }));
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: provider timeout',
      }),
      cloudRun('run-2', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: forbidden',
      }),
    ]);
    prisma.alertEvent.findFirst.mockResolvedValue(alertEventRecord({
      id: 'event-existing',
      status: 'firing',
      occurredAt: new Date('2026-06-26T23:50:00.000Z'),
    }));
    prisma.alertNotificationChannel.findMany.mockResolvedValue([webhookChannel()]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-1', {});

    expect(result.event?.id).toBe('event-existing');
    expect(prisma.alertEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ruleId: 'rule-1',
        status: 'firing',
        occurredAt: { gte: new Date('2026-06-26T23:30:00.000Z') },
      }),
      include: expect.any(Object),
    }));
    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    expect(prisma.alertNotificationDelivery.create).not.toHaveBeenCalled();
    expect(prisma.alertRule.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastStatus: 'firing',
        lastMessage: expect.stringContaining('已去重'),
      }),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'alert.evaluate.deduped',
      targetId: 'event-existing',
      metadata: expect.objectContaining({
        dedupedEventId: 'event-existing',
      }),
    }));
  });

  it('does not deduplicate resolved recovery events', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule());
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Cloud provider live inventory is disabled',
      }),
    ]);
    prisma.alertEvent.findFirst.mockResolvedValue(alertEventRecord({
      id: 'event-old-firing',
      status: 'firing',
      occurredAt: new Date('2026-06-26T23:50:00.000Z'),
    }));

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-1', {});

    expect(result.event?.status).toBe('resolved');
    expect(prisma.alertEvent.findFirst).not.toHaveBeenCalled();
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'resolved',
      }),
      include: expect.any(Object),
    }));
  });

  it('creates planned webhook deliveries for matching alert notification channels by default', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule());
    prisma.alertNotificationChannel.findMany.mockResolvedValue([
      webhookChannel({ eventStatuses: ['firing'], severityFilter: ['warning'] }),
    ]);
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: provider timeout',
      }),
      cloudRun('run-2', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: forbidden',
      }),
    ]);

    await service.evaluateRule('team-1', 'user-1', 'rule-1', {});

    expect(prisma.alertNotificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        teamId: 'team-1',
        channelId: 'channel-1',
        alertEventId: 'event-1',
        channelType: 'webhook',
        status: 'planned',
        dryRun: true,
        target: 'https://hooks.example.test/...',
        requestPayload: expect.objectContaining({
          type: 'devpilot.alert_event',
          alertEvent: expect.objectContaining({
            status: 'firing',
            severity: 'warning',
          }),
        }),
      }),
    }));
    expect(prisma.alertNotificationChannel.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'channel-1' },
      data: expect.objectContaining({
        lastStatus: 'planned',
        lastError: null,
      }),
    }));
  });

  it('formats provider-specific notification payloads for robot channels', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule());
    prisma.alertNotificationChannel.findMany.mockResolvedValue([
      webhookChannel({ type: 'dingtalk', name: '钉钉告警' }),
    ]);
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: provider timeout',
      }),
      cloudRun('run-2', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: forbidden',
      }),
    ]);

    await service.evaluateRule('team-1', 'user-1', 'rule-1', {});

    expect(prisma.alertNotificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        channelType: 'dingtalk',
        requestPayload: expect.objectContaining({
          msgtype: 'markdown',
          markdown: expect.objectContaining({
            title: expect.stringContaining('Devpilot warning/firing'),
            text: expect.stringContaining('### Devpilot warning/firing'),
          }),
        }),
      }),
    }));
  });

  it('creates email notification channels with recipient config separated from public config', async () => {
    await service.createNotificationChannel('team-1', 'user-1', {
      name: '邮件告警',
      type: 'email',
      emailRecipients: ['OPS@example.test', 'ops@example.test', 'sre@example.test'],
      emailSubjectPrefix: 'SRE',
    });

    expect(prisma.alertNotificationChannel.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        teamId: 'team-1',
        createdById: 'user-1',
        type: 'email',
        config: expect.objectContaining({
          provider: 'email',
          method: 'SMTP',
          target: 'ops@example.test +1',
          recipientCount: 2,
          subjectPrefix: 'SRE',
          liveEnabled: false,
        }),
        secretConfig: {
          emailRecipients: ['ops@example.test', 'sre@example.test'],
          emailSubjectPrefix: 'SRE',
        },
      }),
      select: expect.any(Object),
    }));
  });

  it('creates planned email deliveries by default', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule());
    prisma.alertNotificationChannel.findMany.mockResolvedValue([
      webhookChannel({
        type: 'email',
        name: '邮件告警',
        config: { target: 'ops@example.test +1', method: 'SMTP', liveEnabled: false },
        secretConfig: {
          emailRecipients: ['ops@example.test', 'sre@example.test'],
          emailSubjectPrefix: 'SRE',
        },
        eventStatuses: ['firing'],
        severityFilter: ['warning'],
      }),
    ]);
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: provider timeout',
      }),
      cloudRun('run-2', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: forbidden',
      }),
    ]);

    await service.evaluateRule('team-1', 'user-1', 'rule-1', {});

    expect(prisma.alertNotificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        channelType: 'email',
        status: 'planned',
        dryRun: true,
        target: 'ops@example.test +1',
        requestPayload: expect.objectContaining({
          subject: expect.stringContaining('[SRE] Devpilot warning/firing'),
          to: ['ops@example.test', 'sre@example.test'],
          text: expect.stringContaining('云同步失败'),
        }),
        attemptedAt: undefined,
      }),
    }));
    expect(prisma.alertNotificationChannel.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'channel-1' },
      data: expect.objectContaining({
        lastStatus: 'planned',
        lastError: null,
      }),
    }));
  });

  it('retries planned notification deliveries through the current channel adapter', async () => {
    prisma.alertNotificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-old',
      channelId: 'channel-1',
      alertEventId: 'event-1',
      status: 'planned',
    });
    prisma.alertNotificationChannel.findFirst.mockResolvedValue(webhookChannel());
    prisma.alertEvent.findFirst.mockResolvedValue(alertEventRecord());

    const result = await service.retryNotificationDelivery('team-1', 'user-1', 'delivery-old');

    expect(result.status).toBe('planned');
    expect(prisma.alertNotificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        channelId: 'channel-1',
        alertEventId: 'event-1',
        channelType: 'webhook',
        status: 'planned',
        dryRun: true,
      }),
      include: expect.any(Object),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'alert.notification.retry',
      targetType: 'alert_notification_delivery',
      targetId: 'delivery-new',
      status: 'planned',
      metadata: expect.objectContaining({
        sourceDeliveryId: 'delivery-old',
        channelId: 'channel-1',
        dryRun: true,
      }),
    }));
  });

  it('blocks retry for already sent notification deliveries', async () => {
    prisma.alertNotificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-sent',
      channelId: 'channel-1',
      alertEventId: 'event-1',
      status: 'sent',
    });

    await expect(
      service.retryNotificationDelivery('team-1', 'user-1', 'delivery-sent'),
    ).rejects.toThrow('只有失败或计划状态的通知投递可以重试');
    expect(prisma.alertNotificationDelivery.create).not.toHaveBeenCalled();
  });

  it('automatically retries stale failed notification deliveries as system actor', async () => {
    const now = new Date('2026-06-27T00:10:00.000Z');
    const failedDelivery = {
      id: 'delivery-failed',
      teamId: 'team-1',
      channelId: 'channel-1',
      alertEventId: 'event-1',
      createdAt: new Date('2026-06-27T00:00:00.000Z'),
    };
    prisma.alertNotificationDelivery.findMany
      .mockResolvedValueOnce([failedDelivery])
      .mockResolvedValueOnce([{ id: 'delivery-failed' }]);
    prisma.alertNotificationDelivery.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'delivery-failed',
        channelId: 'channel-1',
        alertEventId: 'event-1',
        status: 'failed',
      });
    prisma.alertNotificationChannel.findFirst.mockResolvedValue(webhookChannel());
    prisma.alertEvent.findFirst.mockResolvedValue(alertEventRecord());

    await expect(service.retryFailedNotificationDeliveries({
      now,
      batchSize: 10,
      minAgeSeconds: 300,
      maxAttempts: 3,
      attemptWindowMinutes: 60,
      userId: null,
    })).resolves.toEqual({
      scanned: 1,
      attempted: 1,
      completed: 1,
      failed: 0,
      skippedSuperseded: 0,
      skippedMaxAttempts: 0,
    });
    expect(prisma.alertNotificationDelivery.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        status: 'failed',
        createdAt: { lte: new Date('2026-06-27T00:05:00.000Z') },
      },
      take: 10,
    }));
    expect(prisma.alertNotificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        channelId: 'channel-1',
        alertEventId: 'event-1',
        status: 'planned',
      }),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      actorId: null,
      action: 'alert.notification.retry',
      targetId: 'delivery-new',
      metadata: expect.objectContaining({
        sourceDeliveryId: 'delivery-failed',
      }),
    }));
  });

  it('skips automatic retry when a failed delivery has a newer attempt', async () => {
    prisma.alertNotificationDelivery.findMany.mockResolvedValueOnce([{
      id: 'delivery-old',
      teamId: 'team-1',
      channelId: 'channel-1',
      alertEventId: 'event-1',
      createdAt: new Date('2026-06-27T00:00:00.000Z'),
    }]);
    prisma.alertNotificationDelivery.findFirst.mockResolvedValueOnce({ id: 'delivery-newer' });

    await expect(service.retryFailedNotificationDeliveries({
      now: new Date('2026-06-27T00:10:00.000Z'),
    })).resolves.toEqual({
      scanned: 1,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedSuperseded: 1,
      skippedMaxAttempts: 0,
    });
    expect(prisma.alertNotificationDelivery.create).not.toHaveBeenCalled();
    expect(prisma.alertNotificationDelivery.findMany).toHaveBeenCalledTimes(1);
  });

  it('skips automatic retry after recent attempts reach the configured cap', async () => {
    prisma.alertNotificationDelivery.findMany
      .mockResolvedValueOnce([{
        id: 'delivery-failed',
        teamId: 'team-1',
        channelId: 'channel-1',
        alertEventId: 'event-1',
        createdAt: new Date('2026-06-27T00:00:00.000Z'),
      }])
      .mockResolvedValueOnce([
        { id: 'delivery-failed' },
        { id: 'delivery-retry-1' },
        { id: 'delivery-retry-2' },
      ]);
    prisma.alertNotificationDelivery.findFirst.mockResolvedValueOnce(null);

    await expect(service.retryFailedNotificationDeliveries({
      now: new Date('2026-06-27T00:10:00.000Z'),
      maxAttempts: 3,
    })).resolves.toEqual({
      scanned: 1,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedSuperseded: 0,
      skippedMaxAttempts: 1,
    });
    expect(prisma.alertNotificationDelivery.create).not.toHaveBeenCalled();
  });

  it('escalates stale unacknowledged critical alerts through matching channels', async () => {
    prisma.alertEvent.findMany.mockResolvedValue([
      alertEventRecord({
        id: 'event-critical',
        severity: 'critical',
        status: 'firing',
        occurredAt: new Date('2026-06-26T23:00:00.000Z'),
      }),
    ]);
    prisma.alertNotificationChannel.findMany.mockResolvedValue([
      webhookChannel({ severityFilter: ['critical'] }),
    ]);
    prisma.alertNotificationDelivery.findMany.mockResolvedValueOnce([]);

    await expect(service.escalateStaleAlertEvents({
      now: new Date('2026-06-27T00:00:00.000Z'),
      minAgeSeconds: 900,
      dedupeWindowMinutes: 60,
      batchSize: 10,
    })).resolves.toEqual({
      scanned: 1,
      attempted: 1,
      completed: 1,
      failed: 0,
      skippedNoChannels: 0,
      skippedAlreadyEscalated: 0,
    });
    expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: { in: ['firing', 'error'] },
        severity: { in: ['critical'] },
        acknowledgedAt: null,
        occurredAt: { lte: new Date('2026-06-26T23:45:00.000Z') },
      },
      take: 10,
      include: expect.any(Object),
    }));
    expect(prisma.alertNotificationDelivery.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        alertEventId: 'event-critical',
        channelId: 'channel-1',
        createdAt: { gte: new Date('2026-06-26T23:00:00.000Z') },
      }),
      select: {
        id: true,
        requestPayload: true,
      },
    }));
    expect(prisma.alertNotificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        channelType: 'webhook',
        status: 'planned',
        dryRun: true,
        requestPayload: expect.objectContaining({
          type: 'devpilot.alert_event.escalation',
          escalation: expect.objectContaining({
            level: 'critical_unacknowledged',
            staleMinutes: 60,
          }),
        }),
      }),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      actorId: null,
      action: 'alert.escalate',
      targetType: 'alert_notification_delivery',
      targetId: 'delivery-new',
      metadata: expect.objectContaining({
        alertEventId: 'event-critical',
        channelId: 'channel-1',
        escalation: expect.objectContaining({
          staleMinutes: 60,
        }),
      }),
    }));
  });

  it('skips alert escalation when a recent escalation delivery already exists', async () => {
    prisma.alertEvent.findMany.mockResolvedValue([
      alertEventRecord({
        id: 'event-critical',
        severity: 'critical',
        status: 'firing',
        occurredAt: new Date('2026-06-26T23:00:00.000Z'),
      }),
    ]);
    prisma.alertNotificationChannel.findMany.mockResolvedValue([
      webhookChannel({ severityFilter: ['critical'] }),
    ]);
    prisma.alertNotificationDelivery.findMany.mockResolvedValueOnce([{
      id: 'delivery-escalated',
      requestPayload: {
        type: 'devpilot.alert_event.escalation',
      },
    }]);

    await expect(service.escalateStaleAlertEvents({
      now: new Date('2026-06-27T00:00:00.000Z'),
    })).resolves.toEqual({
      scanned: 1,
      attempted: 0,
      completed: 0,
      failed: 0,
      skippedNoChannels: 0,
      skippedAlreadyEscalated: 1,
    });
    expect(prisma.alertNotificationDelivery.create).not.toHaveBeenCalled();
    expect(auditEventService.create).not.toHaveBeenCalledWith(expect.objectContaining({
      action: 'alert.escalate',
    }));
  });

  it('suppresses matched firing events and skips notification deliveries', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule());
    prisma.alertSilence.findMany.mockResolvedValue([
      alertSilence({ severityFilter: ['warning'] }),
    ]);
    prisma.alertNotificationChannel.findMany.mockResolvedValue([
      webhookChannel({ eventStatuses: ['firing'], severityFilter: ['warning'] }),
    ]);
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: provider timeout',
      }),
      cloudRun('run-2', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: forbidden',
      }),
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-1', {});

    expect(result.event?.status).toBe('suppressed');
    expect(result.rule.lastStatus).toBe('firing');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'suppressed',
        summary: expect.stringContaining('已静默'),
        metadata: expect.objectContaining({
          silence: expect.objectContaining({
            id: 'silence-1',
            name: '发布维护窗口',
          }),
        }),
      }),
      include: expect.any(Object),
    }));
    expect(prisma.alertNotificationDelivery.create).not.toHaveBeenCalled();
    expect(prisma.alertNotificationChannel.update).not.toHaveBeenCalled();
  });

  it('skips notification channels that do not match the event severity', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(baseRule());
    prisma.alertNotificationChannel.findMany.mockResolvedValue([
      webhookChannel({ eventStatuses: ['firing'], severityFilter: ['critical'] }),
    ]);
    prisma.resourceSyncRun.findMany.mockResolvedValue([
      cloudRun('run-1', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: provider timeout',
      }),
      cloudRun('run-2', 'project-1', 'env-prod', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: forbidden',
      }),
    ]);

    await service.evaluateRule('team-1', 'user-1', 'rule-1', {});

    expect(prisma.alertNotificationDelivery.create).not.toHaveBeenCalled();
    expect(prisma.alertNotificationChannel.update).not.toHaveBeenCalled();
  });

  it('fires log alert rules when recent error logs hit the threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(logRule());
    prisma.logEntry.count.mockResolvedValue(2);
    prisma.logEntry.groupBy.mockResolvedValue([
      { level: 'error', _count: { _all: 1 } },
      { level: 'fatal', _count: { _all: 1 } },
    ]);
    prisma.logEntry.findMany.mockResolvedValue([
      {
        id: 'entry-2',
        streamId: 'stream-1',
        level: 'fatal',
        message: 'fatal database unavailable',
        timestamp: new Date('2026-06-26T12:09:00.000Z'),
        source: 'docker',
      },
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-log', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.logEntry.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        teamId: 'team-1',
        projectId: 'project-1',
        environmentId: 'env-prod',
        level: { in: ['error', 'fatal'] },
      }),
    }));
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'log',
        metric: 'log_error_count',
        status: 'firing',
        value: expect.objectContaining({
          count: 2,
          threshold: 2,
          windowMinutes: 60,
          levels: ['error', 'fatal'],
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('resolves log alert rules when recent error logs stay below threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(logRule());
    prisma.logEntry.count.mockResolvedValue(1);
    prisma.logEntry.groupBy.mockResolvedValue([
      { level: 'error', _count: { _all: 1 } },
    ]);
    prisma.logEntry.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-log', {});

    expect(result.event?.status).toBe('resolved');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'resolved',
        value: expect.objectContaining({
          count: 1,
          threshold: 2,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires resource metric threshold rules when recent snapshots exceed the threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(resourceMetricRule());
    prisma.resourceMetricSnapshot.findMany.mockResolvedValue([
      metricSnapshot('snapshot-1', 'resource-1', 'container-api', '2026-06-26T12:09:00.000Z', {
        cpuPercent: 82,
        memoryPercent: 61,
        pids: 12,
      }),
      metricSnapshot('snapshot-2', 'resource-1', 'container-api', '2026-06-26T12:08:00.000Z', {
        cpuPercent: 70,
        memoryPercent: 60,
        pids: 11,
      }),
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-metric', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.resourceMetricSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        teamId: 'team-1',
        resourceId: 'resource-1',
        projectId: 'project-1',
        environmentId: 'env-prod',
        metricSource: 'docker_stats',
        cpuPercent: { not: null },
      }),
      orderBy: { sampledAt: 'desc' },
      take: 500,
    }));
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'resource',
        metric: 'resource_metric_threshold',
        status: 'firing',
        managedResourceId: 'resource-1',
        value: expect.objectContaining({
          metricName: 'cpuPercent',
          aggregation: 'latest',
          operator: 'gte',
          threshold: 80,
          value: 82,
          sampleCount: 2,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('returns insufficient data for resource metric rules without snapshots', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(resourceMetricRule({
      condition: {
        metricName: 'memoryPercent',
        threshold: 90,
        operator: 'gte',
        aggregation: 'max',
        windowMinutes: 30,
      },
    }));
    prisma.resourceMetricSnapshot.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-metric', {});

    expect(result.event?.status).toBe('insufficient_data');
    expect(result.rule.lastStatus).toBe('insufficient_data');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'insufficient_data',
        value: expect.objectContaining({
          metricName: 'memoryPercent',
          threshold: 90,
          aggregation: 'max',
          windowMinutes: 30,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('builds a resource metric dashboard with visible health counts and hotspots', () => {
    const rows = service.buildResourceMetricDashboardRows([
      metricSnapshot('snapshot-1', 'resource-1', 'container-api', '2026-06-26T23:58:00.000Z', {
        cpuPercent: 91,
        memoryPercent: 61,
        pids: 12,
      }),
      metricSnapshot('snapshot-2', 'resource-1', 'container-api', '2026-06-26T23:50:00.000Z', {
        cpuPercent: 70,
        memoryPercent: 60,
        pids: 10,
      }),
      metricSnapshot('snapshot-3', 'resource-2', 'container-worker', '2026-06-26T20:00:00.000Z', {
        cpuPercent: 12,
        memoryPercent: 20,
        pids: 4,
      }),
    ], 60);
    const dashboard = service.summarizeResourceMetricDashboard(
      rows,
      360,
      60,
      new Date('2026-06-27T00:00:00.000Z'),
    );

    expect(rows).toEqual([
      expect.objectContaining({
        resourceId: 'resource-1',
        status: 'critical',
        sampleCount: 2,
        cpuPercent: {
          latest: 91,
          average: 80.5,
          max: 91,
          delta: 21,
        },
      }),
      expect.objectContaining({
        resourceId: 'resource-2',
        status: 'stale',
        statusReason: '最近 240 分钟没有新样本',
      }),
    ]);
    expect(dashboard).toEqual(expect.objectContaining({
      resourceCount: 2,
      sampleCount: 3,
      okCount: 0,
      warningCount: 0,
      criticalCount: 1,
      staleCount: 1,
      maxCpuPercent: 91,
      maxMemoryPercent: 61,
      maxPids: 12,
    }));
  });

  it('queries resource metric dashboard rows with bounded window and limit', async () => {
    prisma.resourceMetricSnapshot.findMany.mockResolvedValue([
      metricSnapshot('snapshot-1', 'resource-1', 'container-api', '2026-06-26T23:58:00.000Z', {
        cpuPercent: 20,
      }),
    ]);

    await service.listResourceMetricDashboardRows('team-1', {
      projectId: 'project-1',
      environmentId: 'env-prod',
      metricSource: 'docker_stats',
      windowMinutes: '120',
      staleAfterMinutes: '30',
      limit: '500',
    });

    expect(prisma.resourceMetricSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        teamId: 'team-1',
        metricSource: 'docker_stats',
        sampledAt: {
          gte: new Date('2026-06-26T22:00:00.000Z'),
          lte: new Date('2026-06-27T00:00:00.000Z'),
        },
        projectId: 'project-1',
        environmentId: 'env-prod',
      },
      orderBy: { sampledAt: 'desc' },
      take: 5000,
      select: expect.any(Object),
    }));
  });

  it('builds a service SLO dashboard with error budget and alert impact', () => {
    const rows = service.buildServiceSloDashboardRows(
      [
        serviceSloService('service-api', 'api'),
        serviceSloService('service-worker', 'worker'),
      ],
      [
        deploymentRun('deploy-1', 'service-api', 'completed'),
        deploymentRun('deploy-2', 'service-api', 'failed'),
      ],
      [
        serviceOperationRun('op-1', 'service-api', 'completed'),
      ],
      [
        serviceAlertEvent('alert-1', 'service-api', 'critical', 'firing'),
      ],
      99,
    );
    const dashboard = service.summarizeServiceSloDashboard(
      rows,
      1440,
      99,
      new Date('2026-06-27T00:00:00.000Z'),
    );

    expect(rows).toEqual([
      expect.objectContaining({
        serviceId: 'service-api',
        status: 'critical',
        sloPercent: 50,
        errorBudgetRemainingPercent: -4900,
        burnRate: 50,
        deploymentCount: 2,
        deploymentSuccessCount: 1,
        deploymentFailureCount: 1,
        operationCount: 1,
        operationSuccessCount: 1,
        alertImpactCount: 1,
        criticalAlertCount: 1,
      }),
      expect.objectContaining({
        serviceId: 'service-worker',
        status: 'no_data',
        sloPercent: null,
      }),
    ]);
    expect(dashboard).toEqual(expect.objectContaining({
      serviceCount: 2,
      criticalCount: 1,
      noDataCount: 1,
      averageSloPercent: 50,
      deploymentCount: 2,
      deploymentFailureCount: 1,
      operationCount: 1,
      alertImpactCount: 1,
      criticalAlertCount: 1,
    }));
  });

  it('queries service SLO dashboard rows with bounded window and filters', async () => {
    prisma.applicationService.findMany.mockResolvedValue([
      serviceSloService('service-api', 'api'),
    ]);
    prisma.deploymentRun.findMany.mockResolvedValue([
      deploymentRun('deploy-1', 'service-api', 'completed'),
    ]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.listServiceSloDashboardRows('team-1', {
      projectId: 'project-1',
      environmentId: 'env-prod',
      applicationServiceId: 'service-api',
      windowMinutes: '120',
      targetPercent: '99.9',
      limit: '500',
    });

    expect(result.targetPercent).toBe(99.9);
    expect(prisma.applicationService.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        teamId: 'team-1',
        status: { not: 'archived' },
        projectId: 'project-1',
        environmentId: 'env-prod',
        id: 'service-api',
      },
      take: 500,
    }));
    expect(prisma.deploymentRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        teamId: 'team-1',
        applicationServiceId: { in: ['service-api'] },
        dryRun: false,
        startedAt: {
          gte: new Date('2026-06-26T22:00:00.000Z'),
          lte: new Date('2026-06-27T00:00:00.000Z'),
        },
      },
    }));
    expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        teamId: 'team-1',
        applicationServiceId: { in: ['service-api'] },
        status: { in: ['firing', 'error', 'suppressed'] },
      }),
    }));
    expect(result.rows[0]).toEqual(expect.objectContaining({
      serviceId: 'service-api',
      targetPercent: 99.9,
      sloPercent: 100,
    }));
  });

  it('fires service SLO breach rules when burn rate reaches the threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceSloRule());
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([
      deploymentRun('deploy-1', 'service-api', 'completed'),
      deploymentRun('deploy-2', 'service-api', 'failed'),
    ]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([
      serviceOperationRun('op-1', 'service-api', 'completed'),
    ]);
    prisma.alertEvent.findMany.mockResolvedValue([
      serviceAlertEvent('alert-1', 'service-api', 'warning', 'firing'),
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-slo', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        metric: { notIn: ['service_slo_breach', 'service_error_budget', 'service_error_budget_exhaustion'] },
      }),
    }));
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'service',
        metric: 'service_slo_breach',
        status: 'firing',
        applicationServiceId: 'service-api',
        value: expect.objectContaining({
          serviceId: 'service-api',
          targetPercent: 99,
          burnRateThreshold: 1,
          sloPercent: 50,
          burnRate: 50,
          deploymentFailureCount: 1,
          alertImpactCount: 1,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('resolves service SLO breach rules when service reliability meets the target', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceSloRule());
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([
      deploymentRun('deploy-1', 'service-api', 'completed'),
      deploymentRun('deploy-2', 'service-api', 'completed'),
    ]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([
      serviceOperationRun('op-1', 'service-api', 'completed'),
    ]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-slo', {});

    expect(result.event?.status).toBe('resolved');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metric: 'service_slo_breach',
        status: 'resolved',
        value: expect.objectContaining({
          sloPercent: 100,
          burnRate: 0,
          deploymentFailureCount: 0,
          alertImpactCount: 0,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('returns insufficient data for service SLO breach rules without real signals', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceSloRule());
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-slo', {});

    expect(result.event?.status).toBe('insufficient_data');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metric: 'service_slo_breach',
        status: 'insufficient_data',
        value: expect.objectContaining({
          serviceId: 'service-api',
          sloPercent: null,
          burnRate: null,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('keeps multi-window service SLO rules resolved when all-policy has only a short-window breach', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceSloRule({
      condition: multiWindowSloCondition(),
    }));
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([
      ...Array.from({ length: 99 }, (_, index) => ({
        ...deploymentRun(`deploy-ok-${index}`, 'service-api', 'completed'),
        startedAt: new Date('2026-06-26T20:00:00.000Z'),
      })),
      {
        ...deploymentRun('deploy-short-failed', 'service-api', 'failed'),
        startedAt: new Date('2026-06-26T23:50:00.000Z'),
      },
    ]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-slo', {});

    expect(result.event?.status).toBe('resolved');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metric: 'service_slo_breach',
        status: 'resolved',
        value: expect.objectContaining({
          strategy: 'multi_window_burn_rate',
          matchPolicy: 'all',
          windowCount: 2,
          windows: expect.arrayContaining([
            expect.objectContaining({
              label: '短窗口',
              windowMinutes: 60,
              status: 'firing',
              deploymentFailureCount: 1,
            }),
            expect.objectContaining({
              label: '长窗口',
              windowMinutes: 360,
              status: 'ok',
              deploymentFailureCount: 1,
            }),
          ]),
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires multi-window service SLO rules when all configured windows breach', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceSloRule({
      condition: multiWindowSloCondition(),
    }));
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([
      {
        ...deploymentRun('deploy-long-failed', 'service-api', 'failed'),
        startedAt: new Date('2026-06-26T20:00:00.000Z'),
      },
      {
        ...deploymentRun('deploy-short-failed', 'service-api', 'failed'),
        startedAt: new Date('2026-06-26T23:50:00.000Z'),
      },
    ]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-slo', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.deploymentRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        startedAt: {
          gte: new Date('2026-06-26T18:00:00.000Z'),
          lte: new Date('2026-06-27T00:00:00.000Z'),
        },
      }),
    }));
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metric: 'service_slo_breach',
        status: 'firing',
        value: expect.objectContaining({
          strategy: 'multi_window_burn_rate',
          matchPolicy: 'all',
          maxWindowMinutes: 360,
          windows: expect.arrayContaining([
            expect.objectContaining({
              label: '短窗口',
              status: 'firing',
              burnRateThreshold: 14,
            }),
            expect.objectContaining({
              label: '长窗口',
              status: 'firing',
              burnRateThreshold: 6,
            }),
          ]),
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires service error budget rules when remaining budget is below the threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceErrorBudgetRule());
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([
      ...Array.from({ length: 9 }, (_, index) => deploymentRun(`deploy-ok-${index}`, 'service-api', 'completed')),
      deploymentRun('deploy-failed', 'service-api', 'failed'),
    ]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-error-budget', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        metric: { notIn: ['service_slo_breach', 'service_error_budget', 'service_error_budget_exhaustion'] },
      }),
    }));
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'service',
        metric: 'service_error_budget',
        status: 'firing',
        applicationServiceId: 'service-api',
        value: expect.objectContaining({
          serviceId: 'service-api',
          targetPercent: 90,
          remainingThresholdPercent: 25,
          errorBudgetRemainingPercent: 0,
          deploymentCount: 10,
          deploymentFailureCount: 1,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('resolves service error budget rules when remaining budget stays above the threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceErrorBudgetRule());
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([
      ...Array.from({ length: 19 }, (_, index) => deploymentRun(`deploy-ok-${index}`, 'service-api', 'completed')),
      deploymentRun('deploy-failed', 'service-api', 'failed'),
    ]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-error-budget', {});

    expect(result.event?.status).toBe('resolved');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metric: 'service_error_budget',
        status: 'resolved',
        value: expect.objectContaining({
          errorBudgetRemainingPercent: 50,
          deploymentCount: 20,
          deploymentFailureCount: 1,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('returns insufficient data for service error budget rules without SLO signals', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceErrorBudgetRule());
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-error-budget', {});

    expect(result.event?.status).toBe('insufficient_data');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metric: 'service_error_budget',
        status: 'insufficient_data',
        value: expect.objectContaining({
          serviceId: 'service-api',
          errorBudgetRemainingPercent: null,
          remainingThresholdPercent: 25,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires service error budget exhaustion forecast rules when burn rate would deplete the budget soon', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceErrorBudgetExhaustionRule());
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([
      ...Array.from({ length: 19 }, (_, index) => deploymentRun(`deploy-ok-${index}`, 'service-api', 'completed')),
      deploymentRun('deploy-failed', 'service-api', 'failed'),
    ]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-error-budget-exhaustion', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        metric: { notIn: ['service_slo_breach', 'service_error_budget', 'service_error_budget_exhaustion'] },
      }),
    }));
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'service',
        metric: 'service_error_budget_exhaustion',
        status: 'firing',
        applicationServiceId: 'service-api',
        value: expect.objectContaining({
          targetPercent: 90,
          exhaustionWithinMinutes: 1440,
          projectedExhaustionMinutes: 1440,
          errorBudgetRemainingPercent: 50,
          burnRate: 0.5,
          deploymentCount: 20,
          deploymentFailureCount: 1,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('resolves service error budget exhaustion forecast rules when current burn is zero', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(serviceErrorBudgetExhaustionRule());
    prisma.applicationService.findFirst.mockResolvedValue(serviceSloService('service-api', 'api'));
    prisma.deploymentRun.findMany.mockResolvedValue([
      ...Array.from({ length: 20 }, (_, index) => deploymentRun(`deploy-ok-${index}`, 'service-api', 'completed')),
    ]);
    prisma.applicationServiceOperationRun.findMany.mockResolvedValue([]);
    prisma.alertEvent.findMany.mockResolvedValue([]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-service-error-budget-exhaustion', {});

    expect(result.event?.status).toBe('resolved');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metric: 'service_error_budget_exhaustion',
        status: 'resolved',
        value: expect.objectContaining({
          projectedExhaustionMinutes: null,
          errorBudgetRemainingPercent: 100,
          burnRate: 0,
          deploymentCount: 20,
          deploymentFailureCount: 0,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires site certificate expiry rules when the certificate is inside the threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteCertificateRule({
      site: siteWithTls({
        enabled: true,
        type: 'letsencrypt',
        expiresAt: '2026-07-01T00:00:00.000Z',
        issuer: 'Let Encrypt Test',
      }),
    }));

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-cert', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'site',
        metric: 'certificate_expiry',
        status: 'firing',
        siteId: 'site-1',
        value: expect.objectContaining({
          thresholdDays: 7,
          daysRemaining: 4,
          expirySource: 'tls.expiresAt',
          issuer: 'Let Encrypt Test',
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('returns insufficient data for enabled TLS sites without certificate expiry metadata', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteCertificateRule({
      site: siteWithTls({
        enabled: true,
        type: 'custom',
      }),
    }));

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-cert', {});

    expect(result.event?.status).toBe('insufficient_data');
    expect(result.rule.lastStatus).toBe('insufficient_data');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'insufficient_data',
        value: expect.objectContaining({
          tlsEnabled: true,
          tlsType: 'custom',
          expiresAt: null,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires site TLS renewal failure rules when certbot renewal failed', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteTlsRenewalFailureRule({
      site: siteWithTls({
        enabled: true,
        type: 'letsencrypt',
        renewal: {
          status: 'failed',
          runId: 'run-renew-1',
          checkedAt: '2026-06-27T00:00:00.000Z',
          summary: 'Certbot renewal failed',
          failureReason: 'Certbot renewal failed',
        },
      }),
    }));

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-tls-renewal', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'site',
        metric: 'tls_renewal_failure',
        status: 'firing',
        siteId: 'site-1',
        value: expect.objectContaining({
          renewalStatus: 'failed',
          renewalRunId: 'run-renew-1',
          renewalSummary: 'Certbot renewal failed',
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires site TLS renewal failure rules when the follow-up probe failed', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteTlsRenewalFailureRule({
      site: siteWithTls({
        enabled: true,
        type: 'letsencrypt',
        renewal: {
          status: 'succeeded',
          runId: 'run-renew-1',
          checkedAt: '2026-06-27T00:00:00.000Z',
          followUpProbe: {
            status: 'failed',
            siteSyncRunId: 'run-probe-1',
            serverExecutionJobId: 'job-probe-1',
            error: 'openssl probe failed',
          },
        },
      }),
    }));

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-tls-renewal', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'site',
        metric: 'tls_renewal_failure',
        status: 'firing',
        siteId: 'site-1',
        value: expect.objectContaining({
          renewalStatus: 'succeeded',
          followUpProbeStatus: 'failed',
          followUpProbeRunId: 'run-probe-1',
          followUpProbeJobId: 'job-probe-1',
          followUpProbeError: 'openssl probe failed',
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('returns insufficient data for TLS renewal failure rules without renewal metadata', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteTlsRenewalFailureRule({
      site: siteWithTls({
        enabled: true,
        type: 'letsencrypt',
      }),
    }));

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-tls-renewal', {});

    expect(result.event?.status).toBe('insufficient_data');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'site',
        metric: 'tls_renewal_failure',
        status: 'insufficient_data',
        value: expect.objectContaining({
          renewalStatus: null,
          followUpProbeStatus: null,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires site smoke-check failure rules when recent live smoke checks failed', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteSmokeCheckFailureRule());
    prisma.siteSyncRun.findMany.mockResolvedValue([
      siteSmokeRun('smoke-2', 'failed', {
        error: 'curl public domain failed',
        result: { status: 'failed', summary: 'public_domain_smoke failed' },
      }),
      siteSmokeRun('smoke-1', 'completed', {
        result: { status: 'completed', summary: 'all smoke checks passed' },
      }),
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-smoke', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.siteSyncRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        teamId: 'team-1',
        siteId: 'site-1',
        mode: 'smoke_check',
        dryRun: false,
      },
      orderBy: { startedAt: 'desc' },
      take: 3,
      select: expect.any(Object),
    }));
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'site',
        metric: 'site_smoke_check_failure',
        status: 'firing',
        siteId: 'site-1',
        value: expect.objectContaining({
          windowRuns: 3,
          failureThreshold: 1,
          includeDryRun: false,
          runCount: 2,
          completedRunCount: 2,
          failureCount: 1,
          latestRuns: expect.arrayContaining([
            expect.objectContaining({
              id: 'smoke-2',
              status: 'failed',
              dryRun: false,
              error: 'curl public domain failed',
              resultSummary: 'public_domain_smoke failed',
            }),
          ]),
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('resolves site smoke-check failure rules when failures stay below the threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteSmokeCheckFailureRule({
      condition: {
        windowRuns: 2,
        failureThreshold: 2,
      },
    }));
    prisma.siteSyncRun.findMany.mockResolvedValue([
      siteSmokeRun('smoke-2', 'failed', { error: 'upstream failed' }),
      siteSmokeRun('smoke-1', 'completed'),
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-smoke', {});

    expect(result.event?.status).toBe('resolved');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'site',
        metric: 'site_smoke_check_failure',
        status: 'resolved',
        value: expect.objectContaining({
          windowRuns: 2,
          failureThreshold: 2,
          failureCount: 1,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires deployment smoke-check failure rules when recent live smoke checks failed', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(deploymentSmokeCheckFailureRule());
    prisma.deploymentRun.findMany.mockResolvedValue([
      deploymentSmokeRun('deploy-smoke-2', 'failed', {
        error: 'curl health check failed',
        result: { status: 'failed', summary: 'health check returned 500' },
      }),
      deploymentSmokeRun('deploy-smoke-1', 'completed', {
        result: { status: 'completed', summary: 'health check passed' },
      }),
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-deployment-smoke', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.deploymentRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        teamId: 'team-1',
        projectId: 'project-1',
        environmentId: 'env-prod',
        applicationId: 'app-1',
        applicationServiceId: 'service-api',
        mode: 'smoke_check',
        dryRun: false,
      },
      orderBy: { startedAt: 'desc' },
      take: 3,
      select: expect.any(Object),
    }));
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'deployment',
        metric: 'deployment_smoke_check_failure',
        status: 'firing',
        projectId: 'project-1',
        environmentId: 'env-prod',
        applicationId: 'app-1',
        applicationServiceId: 'service-api',
        value: expect.objectContaining({
          projectId: 'project-1',
          projectName: '项目 A',
          windowRuns: 3,
          failureThreshold: 1,
          includeDryRun: false,
          runCount: 2,
          completedRunCount: 2,
          failureCount: 1,
          latestRuns: expect.arrayContaining([
            expect.objectContaining({
              id: 'deploy-smoke-2',
              status: 'failed',
              dryRun: false,
              sourceRunId: 'deploy-source-1',
              healthCheckUrl: 'https://api.example.com/health',
              error: 'curl health check failed',
              resultSummary: 'health check returned 500',
            }),
          ]),
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('resolves deployment smoke-check failure rules when failures stay below the threshold', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(deploymentSmokeCheckFailureRule({
      condition: {
        windowRuns: 2,
        failureThreshold: 2,
      },
    }));
    prisma.deploymentRun.findMany.mockResolvedValue([
      deploymentSmokeRun('deploy-smoke-2', 'failed', { error: 'one failed smoke' }),
      deploymentSmokeRun('deploy-smoke-1', 'completed'),
    ]);

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-deployment-smoke', {});

    expect(result.event?.status).toBe('resolved');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'deployment',
        metric: 'deployment_smoke_check_failure',
        status: 'resolved',
        value: expect.objectContaining({
          windowRuns: 2,
          failureThreshold: 2,
          failureCount: 1,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('fires site certificate asset change rules when the active certificate changed recently', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteCertificateAssetChangeRule({
      site: siteWithTls({
        enabled: true,
        type: 'letsencrypt',
        currentCertificateAssetId: 'sha256:NEW',
        lastCertificateAssetChangedAt: '2026-06-26T12:00:00.000Z',
        assets: [
          {
            id: 'sha256:NEW',
            active: true,
            fingerprintSha256: 'NEW',
            issuer: 'R3',
            expiresAt: '2026-09-01T00:00:00.000Z',
          },
          {
            id: 'sha256:OLD',
            active: false,
            fingerprintSha256: 'OLD',
            issuer: 'R3',
            expiresAt: '2026-07-01T00:00:00.000Z',
          },
        ],
      }),
    }));

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-cert-asset', {});

    expect(result.event?.status).toBe('firing');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'site',
        metric: 'certificate_asset_change',
        status: 'firing',
        siteId: 'site-1',
        value: expect.objectContaining({
          windowHours: 24,
          assetCount: 2,
          currentCertificateAssetId: 'sha256:NEW',
          previousCertificateAssetId: 'sha256:OLD',
          currentFingerprint: 'NEW',
          previousFingerprint: 'OLD',
          hoursSinceChange: 12,
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('keeps certificate asset change rules ok for the first observed asset by default', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteCertificateAssetChangeRule({
      site: siteWithTls({
        enabled: true,
        type: 'letsencrypt',
        currentCertificateAssetId: 'sha256:FIRST',
        lastCertificateAssetChangedAt: '2026-06-27T00:00:00.000Z',
        assets: [
          {
            id: 'sha256:FIRST',
            active: true,
            fingerprintSha256: 'FIRST',
            issuer: 'R3',
            expiresAt: '2026-09-01T00:00:00.000Z',
          },
        ],
      }),
    }));

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-cert-asset', {});

    expect(result.event?.status).toBe('resolved');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'site',
        metric: 'certificate_asset_change',
        status: 'resolved',
        value: expect.objectContaining({
          assetCount: 1,
          currentCertificateAssetId: 'sha256:FIRST',
        }),
      }),
      include: expect.any(Object),
    }));
  });

  it('returns insufficient data for certificate asset change rules without assets', async () => {
    prisma.alertRule.findFirst.mockResolvedValue(siteCertificateAssetChangeRule({
      site: siteWithTls({
        enabled: true,
        type: 'letsencrypt',
      }),
    }));

    const result = await service.evaluateRule('team-1', 'user-1', 'rule-site-cert-asset', {});

    expect(result.event?.status).toBe('insufficient_data');
    expect(prisma.alertEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category: 'site',
        metric: 'certificate_asset_change',
        status: 'insufficient_data',
        value: expect.objectContaining({
          assetCount: 0,
          currentCertificateAssetId: null,
        }),
      }),
      include: expect.any(Object),
    }));
  });
});

function baseRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    teamId: 'team-1',
    projectId: 'project-1',
    environmentId: 'env-prod',
    applicationId: null,
    applicationServiceId: null,
    serverId: null,
    siteId: null,
    managedResourceId: null,
    backupPlanId: null,
    category: 'resource',
    metric: 'cloud_provider_sync_failure',
    severity: 'warning',
    enabled: true,
    evaluationMode: 'manual',
    intervalSeconds: 300,
    condition: {
      provider: 'aliyun-rds',
      windowRuns: 5,
      failureThreshold: 2,
      includeConfigFallback: false,
    },
    name: '云同步失败',
    ...overrides,
  };
}

function logRule() {
  return baseRule({
    id: 'rule-log',
    category: 'log',
    metric: 'log_error_count',
    severity: 'critical',
    name: '日志错误数',
    condition: {
      windowMinutes: 60,
      threshold: 2,
      levels: ['error', 'fatal'],
    },
  });
}

function resourceMetricRule(overrides: Record<string, unknown> = {}) {
  return baseRule({
    id: 'rule-metric',
    category: 'resource',
    metric: 'resource_metric_threshold',
    severity: 'warning',
    name: '资源 CPU 阈值',
    managedResourceId: 'resource-1',
    condition: {
      metricName: 'cpuPercent',
      threshold: 80,
      operator: 'gte',
      aggregation: 'latest',
      windowMinutes: 15,
      metricSource: 'docker_stats',
    },
    managedResource: {
      id: 'resource-1',
      name: 'container-api',
      sourceType: 'server',
      provider: 'docker',
      kind: 'docker_container',
      status: 'active',
      endpoint: null,
    },
    ...overrides,
  });
}

function serviceSloRule(overrides: Record<string, unknown> = {}) {
  return baseRule({
    id: 'rule-service-slo',
    category: 'service',
    metric: 'service_slo_breach',
    severity: 'critical',
    name: '服务 SLO 违约',
    applicationId: 'app-1',
    applicationServiceId: 'service-api',
    condition: {
      windowMinutes: 1440,
      targetPercent: 99,
      burnRateThreshold: 1,
    },
    applicationService: {
      id: 'service-api',
      name: 'api',
      kind: 'docker-compose',
      status: 'active',
    },
    ...overrides,
  });
}

function serviceErrorBudgetRule(overrides: Record<string, unknown> = {}) {
  return baseRule({
    id: 'rule-service-error-budget',
    category: 'service',
    metric: 'service_error_budget',
    severity: 'warning',
    name: '服务错误预算',
    applicationId: 'app-1',
    applicationServiceId: 'service-api',
    condition: {
      windowMinutes: 1440,
      targetPercent: 90,
      remainingThresholdPercent: 25,
    },
    applicationService: {
      id: 'service-api',
      name: 'api',
      kind: 'docker-compose',
      status: 'active',
    },
    ...overrides,
  });
}

function serviceErrorBudgetExhaustionRule(overrides: Record<string, unknown> = {}) {
  return baseRule({
    id: 'rule-service-error-budget-exhaustion',
    category: 'service',
    metric: 'service_error_budget_exhaustion',
    severity: 'critical',
    name: '服务错误预算耗尽预测',
    applicationId: 'app-1',
    applicationServiceId: 'service-api',
    condition: {
      windowMinutes: 1440,
      targetPercent: 90,
      exhaustionWithinMinutes: 1440,
    },
    applicationService: {
      id: 'service-api',
      name: 'api',
      kind: 'docker-compose',
      status: 'active',
    },
    ...overrides,
  });
}

function multiWindowSloCondition() {
  return {
    strategy: 'multi_window_burn_rate',
    matchPolicy: 'all',
    targetPercent: 99,
    windows: [
      {
        label: '短窗口',
        windowMinutes: 60,
        burnRateThreshold: 14,
      },
      {
        label: '长窗口',
        windowMinutes: 360,
        burnRateThreshold: 6,
      },
    ],
  };
}

function siteCertificateRule(overrides: Record<string, unknown> = {}) {
  return baseRule({
    id: 'rule-site-cert',
    category: 'site',
    metric: 'certificate_expiry',
    severity: 'warning',
    name: '站点证书过期',
    projectId: 'project-1',
    environmentId: 'env-prod',
    siteId: 'site-1',
    condition: {
      thresholdDays: 7,
    },
    site: siteWithTls({
      enabled: true,
      type: 'letsencrypt',
      notAfter: '2099-01-01T00:00:00.000Z',
    }),
    ...overrides,
  });
}

function siteCertificateAssetChangeRule(overrides: Record<string, unknown> = {}) {
  return baseRule({
    id: 'rule-site-cert-asset',
    category: 'site',
    metric: 'certificate_asset_change',
    severity: 'warning',
    name: '证书变化',
    projectId: 'project-1',
    environmentId: 'env-prod',
    siteId: 'site-1',
    condition: {
      windowHours: 24,
    },
    site: siteWithTls({
      enabled: true,
      type: 'letsencrypt',
      currentCertificateAssetId: 'sha256:CURRENT',
      lastCertificateAssetChangedAt: '2099-01-01T00:00:00.000Z',
      assets: [
        {
          id: 'sha256:CURRENT',
          active: true,
          fingerprintSha256: 'CURRENT',
          issuer: 'R3',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      ],
    }),
    ...overrides,
  });
}

function siteTlsRenewalFailureRule(overrides: Record<string, unknown> = {}) {
  return baseRule({
    id: 'rule-site-tls-renewal',
    category: 'site',
    metric: 'tls_renewal_failure',
    severity: 'critical',
    name: 'TLS 续期失败',
    projectId: 'project-1',
    environmentId: 'env-prod',
    siteId: 'site-1',
    condition: {},
    site: siteWithTls({
      enabled: true,
      type: 'letsencrypt',
      renewal: {
        status: 'succeeded',
      },
    }),
    ...overrides,
  });
}

function siteSmokeCheckFailureRule(overrides: Record<string, unknown> = {}) {
  return baseRule({
    id: 'rule-site-smoke',
    category: 'site',
    metric: 'site_smoke_check_failure',
    severity: 'warning',
    name: 'Smoke 检查失败',
    projectId: 'project-1',
    environmentId: 'env-prod',
    siteId: 'site-1',
    condition: {
      windowRuns: 3,
      failureThreshold: 1,
    },
    site: siteWithTls({
      enabled: false,
      type: 'none',
    }),
    ...overrides,
  });
}

function deploymentSmokeCheckFailureRule(overrides: Record<string, unknown> = {}) {
  return baseRule({
    id: 'rule-deployment-smoke',
    category: 'deployment',
    metric: 'deployment_smoke_check_failure',
    severity: 'warning',
    name: '部署 Smoke 检查失败',
    projectId: 'project-1',
    environmentId: 'env-prod',
    applicationId: 'app-1',
    applicationServiceId: 'service-api',
    condition: {
      windowRuns: 3,
      failureThreshold: 1,
    },
    project: {
      id: 'project-1',
      name: '项目 A',
    },
    ...overrides,
  });
}

function siteWithTls(tls: Record<string, unknown>) {
  return {
    id: 'site-1',
    name: 'api.example.com',
    primaryDomain: 'api.example.com',
    status: 'active',
    tls,
  };
}

function siteSmokeRun(
  id: string,
  status: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    status,
    dryRun: false,
    trigger: 'manual_smoke_check',
    targetConfigPath: 'smoke://api.example.com',
    serverExecutionJobId: `job-${id}`,
    startedAt: new Date(`2026-06-26T12:0${id.at(-1)}:00.000Z`),
    finishedAt: new Date(`2026-06-26T12:0${id.at(-1)}:30.000Z`),
    error: null,
    result: null,
    warnings: [],
    ...overrides,
  };
}

function deploymentSmokeRun(
  id: string,
  status: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    status,
    dryRun: false,
    source: 'manual',
    trigger: 'manual_smoke_check',
    sourceRunId: 'deploy-source-1',
    serverExecutionJobId: `job-${id}`,
    healthCheckUrl: 'https://api.example.com/health',
    startedAt: new Date(`2026-06-26T12:1${id.at(-1)}:00.000Z`),
    finishedAt: new Date(`2026-06-26T12:1${id.at(-1)}:30.000Z`),
    error: null,
    result: null,
    ...overrides,
  };
}

function cloudRun(
  id: string,
  projectId: string,
  environmentId: string,
  providerDiagnostic: Record<string, unknown>,
) {
  return {
    id,
    provider: 'all',
    status: 'completed',
    error: null,
    discovered: 1,
    startedAt: new Date(`2026-06-26T12:0${id.at(-1)}:00.000Z`),
    finishedAt: new Date(`2026-06-26T12:0${id.at(-1)}:30.000Z`),
    metadata: {
      projectId,
      environmentId,
      providers: [providerDiagnostic],
    },
  };
}

function metricSnapshot(
  id: string,
  resourceId: string,
  resourceName: string,
  sampledAt: string,
  metrics: {
    cpuPercent?: number | null;
    memoryPercent?: number | null;
    pids?: number | null;
  },
) {
  return {
    id,
    resourceId,
    projectId: 'project-1',
    environmentId: 'env-prod',
    sourceType: 'server',
    provider: 'docker',
    kind: 'docker_container',
    sampledAt: new Date(sampledAt),
    status: 'collected',
    metricSource: 'docker_stats',
    cpuPercent: metrics.cpuPercent ?? null,
    memoryPercent: metrics.memoryPercent ?? null,
    memoryUsageBytes: null,
    networkInputBytes: null,
    networkOutputBytes: null,
    blockInputBytes: null,
    blockOutputBytes: null,
    pids: metrics.pids ?? null,
    resource: {
      id: resourceId,
      name: resourceName,
      provider: 'docker',
      kind: 'docker_container',
      sourceType: 'server',
      status: 'active',
      endpoint: null,
      project: { id: 'project-1', name: '项目 A' },
      environment: { id: 'env-prod', key: 'prod', name: '生产', status: 'active' },
    },
  };
}

function serviceSloService(id: string, name: string) {
  return {
    id,
    projectId: 'project-1',
    environmentId: 'env-prod',
    applicationId: 'app-1',
    name,
    kind: 'docker-compose',
    status: 'active',
    runtime: 'node',
    project: { id: 'project-1', name: '项目 A' },
    environment: { id: 'env-prod', key: 'prod', name: '生产', status: 'active' },
    application: { id: 'app-1', name: '主应用', status: 'active' },
  };
}

function deploymentRun(id: string, serviceId: string, status: string) {
  return {
    id,
    applicationServiceId: serviceId,
    status,
    startedAt: new Date('2026-06-26T23:00:00.000Z'),
    finishedAt: new Date('2026-06-26T23:05:00.000Z'),
    error: status === 'failed' ? 'deploy failed' : null,
  };
}

function serviceOperationRun(id: string, serviceId: string, status: string) {
  return {
    id,
    applicationServiceId: serviceId,
    action: 'restart',
    status,
    startedAt: new Date('2026-06-26T23:10:00.000Z'),
    finishedAt: new Date('2026-06-26T23:11:00.000Z'),
    error: status === 'failed' ? 'restart failed' : null,
  };
}

function serviceAlertEvent(id: string, serviceId: string, severity: string, status: string) {
  return {
    id,
    applicationServiceId: serviceId,
    severity,
    status,
    occurredAt: new Date('2026-06-26T23:20:00.000Z'),
  };
}

function webhookChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'channel-1',
    teamId: 'team-1',
    projectId: 'project-1',
    environmentId: 'env-prod',
    name: '运维 Webhook',
    type: 'webhook',
    status: 'active',
    config: { target: 'https://hooks.example.test/...' },
    secretConfig: { webhookUrl: 'https://hooks.example.test/devpilot-alerts' },
    eventStatuses: ['firing', 'error'],
    severityFilter: [],
    ...overrides,
  };
}

function alertEventRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    teamId: 'team-1',
    ruleId: 'rule-1',
    actorId: 'user-1',
    projectId: 'project-1',
    environmentId: 'env-prod',
    applicationId: null,
    applicationServiceId: null,
    serverId: null,
    siteId: null,
    managedResourceId: null,
    backupPlanId: null,
    category: 'resource',
    metric: 'cloud_provider_sync_failure',
    severity: 'warning',
    status: 'firing',
    summary: '云同步失败',
    value: {},
    metadata: {},
    occurredAt: new Date('2026-06-26T12:10:00.000Z'),
    resolvedAt: null,
    acknowledgedAt: null,
    createdAt: new Date('2026-06-26T12:10:00.000Z'),
    updatedAt: new Date('2026-06-26T12:10:00.000Z'),
    rule: {
      id: 'rule-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      name: '云同步失败',
      metric: 'cloud_provider_sync_failure',
      severity: 'warning',
      enabled: true,
    },
    actor: { id: 'user-1', name: 'Owner', email: 'owner@example.test' },
    project: { id: 'project-1', name: '项目 A' },
    environment: { id: 'env-prod', key: 'prod', name: '生产', status: 'active' },
    application: null,
    applicationService: null,
    server: null,
    site: null,
    managedResource: null,
    backupPlan: null,
    ...overrides,
  };
}

function alertSilence(overrides: Record<string, unknown> = {}) {
  return {
    id: 'silence-1',
    teamId: 'team-1',
    createdById: 'user-1',
    projectId: 'project-1',
    environmentId: 'env-prod',
    name: '发布维护窗口',
    status: 'active',
    category: 'resource',
    metric: 'cloud_provider_sync_failure',
    severityFilter: [],
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: new Date('2099-01-01T00:00:00.000Z'),
    reason: '发布维护',
    createdAt: new Date('2026-06-26T11:55:00.000Z'),
    updatedAt: new Date('2026-06-26T11:55:00.000Z'),
    createdBy: { id: 'user-1', name: 'Owner', email: 'owner@example.test' },
    project: { id: 'project-1', name: '项目 A' },
    environment: { id: 'env-prod', key: 'prod', name: '生产', status: 'active' },
    ...overrides,
  };
}
