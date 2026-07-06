import { Injectable } from "@nestjs/common";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { MonitoringAlertServiceSloConditionService } from "./monitoring-alert-service-slo-condition.service";
import { MonitoringAlertServiceSloSignalService } from "./monitoring-alert-service-slo-signal.service";
import { MonitoringAlertServiceSloWindowService } from "./monitoring-alert-service-slo-window.service";

@Injectable()
export class MonitoringAlertServiceSloBreachEvaluationService {
  constructor(
    private readonly result: MonitoringAlertEvaluationResultService,
    private readonly conditionReader: MonitoringAlertServiceSloConditionService,
    private readonly signalService: MonitoringAlertServiceSloSignalService,
    private readonly windowService: MonitoringAlertServiceSloWindowService,
  ) {}

  async evaluate(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    if (!rule.applicationServiceId) {
      return this.result.insufficient(rule, "规则未绑定服务目标", {});
    }

    const condition = this.conditionReader.asRecord(rule.condition);
    const windowSpecs = this.windowService.readWindowSpecs(condition);
    const matchPolicy = this.windowService.readMatchPolicy(
      condition,
      windowSpecs.length,
    );
    const strategy =
      this.conditionReader.readString(condition.strategy) ||
      (windowSpecs.length > 1 ? "multi_window_burn_rate" : "single_window");
    const maxWindowMinutes = Math.max(
      ...windowSpecs.map((window) => window.windowMinutes),
    );
    const generatedAt = new Date();
    const from = new Date(generatedAt.getTime() - maxWindowMinutes * 60 * 1000);
    const signals = await this.signalService.loadSignals(
      rule,
      from,
      generatedAt,
    );

    if (!signals) {
      return this.result.insufficient(rule, "服务目标不存在", {
        serviceId: rule.applicationServiceId,
        maxWindowMinutes,
        targetPercent: windowSpecs[0]?.targetPercent ?? 99,
      });
    }

    const windowEvaluations = windowSpecs.map((window) =>
      this.windowService.evaluateWindow(signals, window, generatedAt),
    );
    const primaryWindow = windowEvaluations[0];
    const firingWindows = windowEvaluations.filter(
      (window) => window.status === "firing",
    );
    const noDataWindows = windowEvaluations.filter(
      (window) => window.status === "no_data",
    );
    const value = {
      serviceId: signals.service.id,
      serviceName: signals.service.name,
      projectId: signals.service.projectId,
      environmentId: signals.service.environmentId,
      applicationId: signals.service.applicationId,
      strategy,
      matchPolicy,
      maxWindowMinutes,
      windowCount: windowEvaluations.length,
      windowMinutes: primaryWindow.windowMinutes,
      targetPercent: primaryWindow.targetPercent,
      burnRateThreshold: primaryWindow.burnRateThreshold,
      status: primaryWindow.status,
      statusReason: primaryWindow.statusReason,
      sloPercent: primaryWindow.sloPercent,
      errorBudgetRemainingPercent: primaryWindow.errorBudgetRemainingPercent,
      burnRate: primaryWindow.burnRate,
      deploymentCount: primaryWindow.deploymentCount,
      deploymentFailureCount: primaryWindow.deploymentFailureCount,
      operationCount: primaryWindow.operationCount,
      operationFailureCount: primaryWindow.operationFailureCount,
      alertImpactCount: primaryWindow.alertImpactCount,
      criticalAlertCount: primaryWindow.criticalAlertCount,
      windows: windowEvaluations.map((window) => ({
        label: window.label,
        windowMinutes: window.windowMinutes,
        targetPercent: window.targetPercent,
        burnRateThreshold: window.burnRateThreshold,
        status: window.status,
        statusReason: window.statusReason,
        from: window.from,
        to: window.to,
        sloPercent: window.sloPercent,
        errorBudgetRemainingPercent: window.errorBudgetRemainingPercent,
        burnRate: window.burnRate,
        deploymentCount: window.deploymentCount,
        deploymentFailureCount: window.deploymentFailureCount,
        operationCount: window.operationCount,
        operationFailureCount: window.operationFailureCount,
        alertImpactCount: window.alertImpactCount,
        criticalAlertCount: window.criticalAlertCount,
        breachReasons: window.breachReasons,
      })),
    };

    if (noDataWindows.length === windowEvaluations.length) {
      return this.result.insufficient(
        rule,
        `${signals.service.name} 在配置的 SLO 窗口内暂无真实 SLO 信号`,
        value,
      );
    }

    if (
      matchPolicy === "all" &&
      firingWindows.length > 0 &&
      noDataWindows.length > 0
    ) {
      return this.result.insufficient(
        rule,
        `${signals.service.name} SLO 部分窗口缺少信号，无法确认全部窗口策略`,
        value,
      );
    }

    const shouldFire =
      matchPolicy === "all"
        ? firingWindows.length === windowEvaluations.length
        : firingWindows.length > 0;

    if (shouldFire) {
      return this.result.firing(
        rule,
        `${signals.service.name} SLO ${this.windowService.formatWindowSummary(firingWindows)} 触发${matchPolicy === "all" ? "全部" : "任一"}窗口策略`,
        value,
      );
    }

    if (firingWindows.length > 0) {
      return this.result.ok(
        rule,
        `${signals.service.name} SLO ${this.windowService.formatWindowSummary(firingWindows)} 已违约，但未满足全部窗口策略`,
        value,
      );
    }

    return this.result.ok(
      rule,
      `${signals.service.name} SLO ${this.windowService.formatWindowSummary(windowEvaluations)} 均未触发违约`,
      value,
    );
  }
}
