import { Injectable } from "@nestjs/common";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { MonitoringAlertServiceSloSignalService } from "./monitoring-alert-service-slo-signal.service";
import { MonitoringAlertServiceSloWindowService } from "./monitoring-alert-service-slo-window.service";
import type { ServiceSloWindowEvaluation } from "./monitoring-alert-service-slo-window.types";

@Injectable()
export class MonitoringAlertServiceSloBudgetWindowService {
  constructor(
    private readonly signalService: MonitoringAlertServiceSloSignalService,
    private readonly windowService: MonitoringAlertServiceSloWindowService,
  ) {}

  async loadWindow(
    rule: AlertRuleRecord,
    windowMinutes: number,
    targetPercent: number,
    label: string,
  ) {
    const generatedAt = new Date();
    const from = new Date(generatedAt.getTime() - windowMinutes * 60 * 1000);
    const signals = await this.signalService.loadSignals(
      rule,
      from,
      generatedAt,
    );
    if (!signals) return null;
    return {
      serviceName: signals.service.name,
      service: signals.service,
      window: this.windowService.evaluateWindow(
        signals,
        { label, windowMinutes, targetPercent, burnRateThreshold: 100 },
        generatedAt,
      ),
    };
  }

  buildBaseValue(
    loaded: {
      service: {
        id: string;
        name: string;
        projectId: string;
        environmentId: string;
        applicationId: string;
      };
      window: ServiceSloWindowEvaluation;
    },
    extra: Record<string, unknown>,
  ) {
    return {
      serviceId: loaded.service.id,
      serviceName: loaded.service.name,
      projectId: loaded.service.projectId,
      environmentId: loaded.service.environmentId,
      applicationId: loaded.service.applicationId,
      windowMinutes: loaded.window.windowMinutes,
      targetPercent: loaded.window.targetPercent,
      status: loaded.window.status,
      statusReason: loaded.window.statusReason,
      sloPercent: loaded.window.sloPercent,
      errorBudgetRemainingPercent: loaded.window.errorBudgetRemainingPercent,
      burnRate: loaded.window.burnRate,
      deploymentCount: loaded.window.deploymentCount,
      deploymentFailureCount: loaded.window.deploymentFailureCount,
      operationCount: loaded.window.operationCount,
      operationFailureCount: loaded.window.operationFailureCount,
      alertImpactCount: loaded.window.alertImpactCount,
      criticalAlertCount: loaded.window.criticalAlertCount,
      from: loaded.window.from,
      to: loaded.window.to,
      ...extra,
    };
  }

  formatPercentValue(value: number) {
    return `${Number(value.toFixed(2))}%`;
  }
}
