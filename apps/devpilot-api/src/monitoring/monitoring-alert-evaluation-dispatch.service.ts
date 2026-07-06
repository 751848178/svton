import { Injectable } from "@nestjs/common";
import { MonitoringAlertBackupStatusEvaluationService } from "./monitoring-alert-backup-status-evaluation.service";
import { MonitoringAlertCloudProviderSyncEvaluationService } from "./monitoring-alert-cloud-provider-sync-evaluation.service";
import { MonitoringAlertDeploymentStatusEvaluationService } from "./monitoring-alert-deployment-status-evaluation.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import { MonitoringAlertLogCountEvaluationService } from "./monitoring-alert-log-count-evaluation.service";
import { MonitoringAlertResourceMetricThresholdEvaluationService } from "./monitoring-alert-resource-metric-threshold-evaluation.service";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { MonitoringAlertServiceSloEvaluationService } from "./monitoring-alert-service-slo-evaluation.service";
import { MonitoringAlertSiteCertificateEvaluationService } from "./monitoring-alert-site-certificate-evaluation.service";
import { MonitoringAlertSmokeCheckEvaluationService } from "./monitoring-alert-smoke-check-evaluation.service";
import { MonitoringAlertStatusEvaluationService } from "./monitoring-alert-status-evaluation.service";

@Injectable()
export class MonitoringAlertEvaluationDispatchService {
  constructor(
    private readonly alertStatusEvaluationService: MonitoringAlertStatusEvaluationService,
    private readonly alertSiteCertificateEvaluationService: MonitoringAlertSiteCertificateEvaluationService,
    private readonly serviceSloEvaluationService: MonitoringAlertServiceSloEvaluationService,
    private readonly alertSmokeCheckEvaluationService: MonitoringAlertSmokeCheckEvaluationService,
    private readonly alertLogCountEvaluationService: MonitoringAlertLogCountEvaluationService,
    private readonly alertDeploymentStatusEvaluationService: MonitoringAlertDeploymentStatusEvaluationService,
    private readonly alertBackupStatusEvaluationService: MonitoringAlertBackupStatusEvaluationService,
    private readonly alertCloudProviderSyncEvaluationService: MonitoringAlertCloudProviderSyncEvaluationService,
    private readonly alertResourceMetricThresholdEvaluationService: MonitoringAlertResourceMetricThresholdEvaluationService,
  ) {}

  async evaluate(
    rule: AlertRuleRecord,
    observedValue: Record<string, unknown>,
  ): Promise<AlertEvaluationResult> {
    if (Object.keys(observedValue).length > 0) {
      return this.alertStatusEvaluationService.evaluateObservedValue(
        rule,
        observedValue,
      );
    }

    switch (rule.category) {
      case "server":
        return this.alertStatusEvaluationService.evaluateTarget(
          rule,
          rule.server,
          ["online"],
          "服务器状态",
        );
      case "site":
        return this.evaluateSiteRule(rule);
      case "resource":
        return this.evaluateResourceRule(rule);
      case "backup":
        return this.alertBackupStatusEvaluationService.evaluate(rule);
      case "deployment":
        return this.evaluateDeploymentRule(rule);
      case "log":
        return this.alertLogCountEvaluationService.evaluate(rule);
      case "service":
        return this.evaluateServiceRule(rule);
      default:
        return this.alertStatusEvaluationService.evaluateTarget(
          rule,
          rule.applicationService,
          ["active"],
          "服务状态",
        );
    }
  }

  private evaluateSiteRule(rule: AlertRuleRecord) {
    if (rule.metric === "certificate_expiry") {
      return this.alertSiteCertificateEvaluationService.evaluateCertificateExpiry(
        rule,
      );
    }
    if (rule.metric === "certificate_asset_change") {
      return this.alertSiteCertificateEvaluationService.evaluateCertificateAssetChange(
        rule,
      );
    }
    if (rule.metric === "tls_renewal_failure") {
      return this.alertSiteCertificateEvaluationService.evaluateTlsRenewalFailure(
        rule,
      );
    }
    if (rule.metric === "site_smoke_check_failure") {
      return this.alertSmokeCheckEvaluationService.evaluateSiteSmokeCheckFailure(
        rule,
      );
    }
    return this.alertStatusEvaluationService.evaluateTarget(
      rule,
      rule.site,
      ["active"],
      "站点状态",
    );
  }

  private evaluateResourceRule(rule: AlertRuleRecord) {
    if (rule.metric === "cloud_provider_sync_failure") {
      return this.alertCloudProviderSyncEvaluationService.evaluate(rule);
    }
    if (rule.metric === "resource_metric_threshold") {
      return this.alertResourceMetricThresholdEvaluationService.evaluate(rule);
    }
    return this.alertStatusEvaluationService.evaluateTarget(
      rule,
      rule.managedResource,
      ["active", "running"],
      "资源状态",
    );
  }

  private evaluateDeploymentRule(rule: AlertRuleRecord) {
    if (rule.metric === "deployment_smoke_check_failure") {
      return this.alertSmokeCheckEvaluationService.evaluateDeploymentSmokeCheckFailure(
        rule,
      );
    }
    return this.alertDeploymentStatusEvaluationService.evaluate(rule);
  }

  private evaluateServiceRule(rule: AlertRuleRecord) {
    if (rule.metric === "service_slo_breach") {
      return this.serviceSloEvaluationService.evaluateBreach(rule);
    }
    if (rule.metric === "service_error_budget") {
      return this.serviceSloEvaluationService.evaluateErrorBudget(rule);
    }
    if (rule.metric === "service_error_budget_exhaustion") {
      return this.serviceSloEvaluationService.evaluateErrorBudgetExhaustion(
        rule,
      );
    }
    return this.alertStatusEvaluationService.evaluateTarget(
      rule,
      rule.applicationService,
      ["active"],
      "服务状态",
    );
  }
}
