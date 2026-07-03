import { Module } from "@nestjs/common";
import { AuditEventModule } from "../audit-event";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { MonitoringAccessService } from "./monitoring-access.service";
import { MonitoringAlertEscalationAuditService } from "./monitoring-alert-escalation-audit.service";
import { MonitoringAlertEscalationService } from "./monitoring-alert-escalation.service";
import { MonitoringAlertSilenceMatcherService } from "./monitoring-alert-silence-matcher.service";
import { MonitoringAlertSilenceWindowService } from "./monitoring-alert-silence-window.service";
import { MonitoringAlertSilenceService } from "./monitoring-alert-silence.service";
import { MonitoringDashboardController } from "./monitoring-dashboard.controller";
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
import { MonitoringSilenceController } from "./monitoring-silence.controller";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringSchedulerConfigService } from "./monitoring-scheduler-config.service";
import { MonitoringSchedulerService } from "./monitoring-scheduler.service";
import { MonitoringService } from "./monitoring.service";

@Module({
  imports: [PrismaModule, AuditEventModule, ControlAccessPolicyModule],
  controllers: [
    MonitoringController,
    MonitoringDashboardController,
    MonitoringSilenceController,
    MonitoringNotificationController,
  ],
  providers: [
    MonitoringService,
    MonitoringAccessService,
    MonitoringAlertEscalationAuditService,
    MonitoringAlertEscalationService,
    MonitoringAlertSilenceMatcherService,
    MonitoringAlertSilenceWindowService,
    MonitoringAlertSilenceService,
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
    MonitoringSchedulerConfigService,
    MonitoringSchedulerService,
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}
