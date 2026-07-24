import { Module } from "@nestjs/common";
import { AuditEventModule } from "../audit-event";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { ResourceControlModule } from "../resource-control/resource-control.module";
import { MonitoringAccessService } from "./monitoring-access.service";
import { MonitoringAlertBackupStatusEvaluationService } from "./monitoring-alert-backup-status-evaluation.service";
import { MonitoringAlertCloudProviderSyncEvaluationService } from "./monitoring-alert-cloud-provider-sync-evaluation.service";
import { MonitoringAlertDeploymentStatusEvaluationService } from "./monitoring-alert-deployment-status-evaluation.service";
import { MonitoringAlertEventAuditService } from "./monitoring-alert-event-audit.service";
import { MonitoringAlertEventService } from "./monitoring-alert-event.service";
import { MonitoringAlertEvaluationDispatchService } from "./monitoring-alert-evaluation-dispatch.service";
import { MonitoringAlertEvaluationEventService } from "./monitoring-alert-evaluation-event.service";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import { MonitoringAlertDeploymentSmokeCheckEvaluationService } from "./monitoring-alert-deployment-smoke-check-evaluation.service";
import { MonitoringAlertEscalationAuditService } from "./monitoring-alert-escalation-audit.service";
import { MonitoringAlertEscalationService } from "./monitoring-alert-escalation.service";
import { MonitoringAlertLogCountEvaluationService } from "./monitoring-alert-log-count-evaluation.service";
import { MonitoringAlertResourceMetricThresholdEvaluationService } from "./monitoring-alert-resource-metric-threshold-evaluation.service";
import { MonitoringAlertRuleTargetService } from "./monitoring-alert-rule-target.service";
import { MonitoringAlertRuleService } from "./monitoring-alert-rule.service";
import { MonitoringAlertServiceSloBreachEvaluationService } from "./monitoring-alert-service-slo-breach-evaluation.service";
import { MonitoringAlertServiceSloBudgetEvaluationService } from "./monitoring-alert-service-slo-budget-evaluation.service";
import { MonitoringAlertServiceSloBudgetWindowService } from "./monitoring-alert-service-slo-budget-window.service";
import { MonitoringAlertServiceSloConditionService } from "./monitoring-alert-service-slo-condition.service";
import { MonitoringAlertServiceSloEvaluationService } from "./monitoring-alert-service-slo-evaluation.service";
import { MonitoringAlertServiceSloExhaustionEvaluationService } from "./monitoring-alert-service-slo-exhaustion-evaluation.service";
import { MonitoringAlertServiceSloSignalService } from "./monitoring-alert-service-slo-signal.service";
import { MonitoringAlertServiceSloWindowService } from "./monitoring-alert-service-slo-window.service";
import { MonitoringAlertSiteCertificateAssetEvaluationService } from "./monitoring-alert-site-certificate-asset-evaluation.service";
import { MonitoringAlertSiteCertificateEvaluationService } from "./monitoring-alert-site-certificate-evaluation.service";
import { MonitoringAlertSiteCertificateExpiryEvaluationService } from "./monitoring-alert-site-certificate-expiry-evaluation.service";
import { MonitoringAlertSiteCertificateReaderService } from "./monitoring-alert-site-certificate-reader.service";
import { MonitoringAlertSiteSmokeCheckEvaluationService } from "./monitoring-alert-site-smoke-check-evaluation.service";
import { MonitoringAlertSiteTlsRenewalEvaluationService } from "./monitoring-alert-site-tls-renewal-evaluation.service";
import { MonitoringAlertSilenceMatcherService } from "./monitoring-alert-silence-matcher.service";
import { MonitoringAlertSilenceWindowService } from "./monitoring-alert-silence-window.service";
import { MonitoringAlertSilenceService } from "./monitoring-alert-silence.service";
import { MonitoringAlertSmokeCheckEvaluationService } from "./monitoring-alert-smoke-check-evaluation.service";
import { MonitoringAlertStatusEvaluationService } from "./monitoring-alert-status-evaluation.service";
import { MonitoringDashboardController } from "./monitoring-dashboard.controller";
import { MonitoringMetricCollectionSchedulerService } from "./monitoring-metric-collection-scheduler.service";
import { MonitoringNotificationChannelSettingsService } from "./monitoring-notification-channel-settings.service";
import { MonitoringNotificationChannelService } from "./monitoring-notification-channel.service";
import { MonitoringNotificationDeliveryConfigService } from "./monitoring-notification-delivery-config.service";
import { MonitoringNotificationDeliveryDispatchService } from "./monitoring-notification-delivery-dispatch.service";
import { MonitoringNotificationDeliveryEmailSenderService } from "./monitoring-notification-delivery-email-sender.service";
import { MonitoringNotificationDeliveryEmailService } from "./monitoring-notification-delivery-email.service";
import { MonitoringNotificationDeliveryPayloadService } from "./monitoring-notification-delivery-payload.service";
import { MonitoringNotificationDeliveryReadService } from "./monitoring-notification-delivery-read.service";
import { MonitoringNotificationDeliveryWebhookService } from "./monitoring-notification-delivery-webhook.service";
import { MonitoringNotificationDeliveryWriterService } from "./monitoring-notification-delivery-writer.service";
import { MonitoringNotificationController } from "./monitoring-notification.controller";
import { MonitoringNotificationRetryAuditService } from "./monitoring-notification-retry-audit.service";
import { MonitoringNotificationRetryService } from "./monitoring-notification-retry.service";
import { MonitoringProjectEnvironmentScopeService } from "./monitoring-project-environment-scope.service";
import { MonitoringResourceMetricDashboardBuilderService } from "./monitoring-resource-metric-dashboard-builder.service";
import { MonitoringResourceMetricDashboardService } from "./monitoring-resource-metric-dashboard.service";
import { MonitoringServiceSloDashboardBuilderService } from "./monitoring-service-slo-dashboard-builder.service";
import { MonitoringServiceSloDashboardService } from "./monitoring-service-slo-dashboard.service";
import { MonitoringServiceSloDashboardStatusService } from "./monitoring-service-slo-dashboard-status.service";
import { MonitoringServiceSloRuleTemplateService } from "./monitoring-service-slo-rule-template.service";
import { MonitoringSilenceController } from "./monitoring-silence.controller";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringSchedulerConfigService } from "./monitoring-scheduler-config.service";
import { MonitoringSchedulerService } from "./monitoring-scheduler.service";
import { MonitoringService } from "./monitoring.service";

@Module({
  imports: [
    PrismaModule,
    AuditEventModule,
    ControlAccessPolicyModule,
    ResourceControlModule,
  ],
  controllers: [
    MonitoringController,
    MonitoringDashboardController,
    MonitoringSilenceController,
    MonitoringNotificationController,
  ],
  providers: [
    MonitoringService,
    MonitoringAccessService,
    MonitoringAlertBackupStatusEvaluationService,
    MonitoringAlertCloudProviderSyncEvaluationService,
    MonitoringAlertDeploymentStatusEvaluationService,
    MonitoringAlertEventAuditService,
    MonitoringAlertEventService,
    MonitoringAlertEvaluationDispatchService,
    MonitoringAlertEvaluationEventService,
    MonitoringAlertEvaluationResultService,
    MonitoringAlertDeploymentSmokeCheckEvaluationService,
    MonitoringAlertEscalationAuditService,
    MonitoringAlertEscalationService,
    MonitoringAlertLogCountEvaluationService,
    MonitoringAlertResourceMetricThresholdEvaluationService,
    MonitoringAlertRuleTargetService,
    MonitoringAlertRuleService,
    MonitoringAlertServiceSloBreachEvaluationService,
    MonitoringAlertServiceSloBudgetEvaluationService,
    MonitoringAlertServiceSloBudgetWindowService,
    MonitoringAlertServiceSloConditionService,
    MonitoringAlertServiceSloEvaluationService,
    MonitoringAlertServiceSloExhaustionEvaluationService,
    MonitoringAlertServiceSloSignalService,
    MonitoringAlertServiceSloWindowService,
    MonitoringAlertSiteCertificateAssetEvaluationService,
    MonitoringAlertSiteCertificateEvaluationService,
    MonitoringAlertSiteCertificateExpiryEvaluationService,
    MonitoringAlertSiteCertificateReaderService,
    MonitoringAlertSiteSmokeCheckEvaluationService,
    MonitoringAlertSiteTlsRenewalEvaluationService,
    MonitoringAlertSilenceMatcherService,
    MonitoringAlertSilenceWindowService,
    MonitoringAlertSilenceService,
    MonitoringAlertSmokeCheckEvaluationService,
    MonitoringAlertStatusEvaluationService,
    MonitoringNotificationChannelSettingsService,
    MonitoringNotificationChannelService,
    MonitoringNotificationDeliveryConfigService,
    MonitoringNotificationDeliveryDispatchService,
    MonitoringNotificationDeliveryEmailSenderService,
    MonitoringNotificationDeliveryEmailService,
    MonitoringNotificationDeliveryPayloadService,
    MonitoringNotificationDeliveryReadService,
    MonitoringNotificationDeliveryWebhookService,
    MonitoringNotificationDeliveryWriterService,
    MonitoringNotificationRetryAuditService,
    MonitoringNotificationRetryService,
    MonitoringProjectEnvironmentScopeService,
    MonitoringResourceMetricDashboardBuilderService,
    MonitoringResourceMetricDashboardService,
    MonitoringServiceSloDashboardBuilderService,
    MonitoringServiceSloDashboardService,
    MonitoringServiceSloDashboardStatusService,
    MonitoringServiceSloRuleTemplateService,
    MonitoringSchedulerConfigService,
    MonitoringSchedulerService,
    MonitoringMetricCollectionSchedulerService,
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}
