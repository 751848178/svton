import { Injectable } from "@nestjs/common";
import { MonitoringAlertServiceSloConditionService } from "./monitoring-alert-service-slo-condition.service";
import { readPositiveInt } from "./monitoring-number.utils";
import { MonitoringServiceSloDashboardBuilderService } from "./monitoring-service-slo-dashboard-builder.service";
import type {
  ServiceSloMatchPolicy,
  ServiceSloWindowEvaluation,
  ServiceSloWindowSignals,
  ServiceSloWindowSpec,
} from "./monitoring-alert-service-slo-window.types";

@Injectable()
export class MonitoringAlertServiceSloWindowService {
  constructor(
    private readonly conditionReader: MonitoringAlertServiceSloConditionService,
    private readonly dashboardBuilder: MonitoringServiceSloDashboardBuilderService,
  ) {}

  readWindowSpecs(condition: Record<string, unknown>): ServiceSloWindowSpec[] {
    const fallbackTargetPercent = this.conditionReader.readPercent(
      condition.targetPercent,
      99,
      50,
      99.99,
    );
    const fallbackBurnRateThreshold = this.conditionReader.readPercent(
      condition.burnRateThreshold,
      1,
      0.1,
      100,
    );
    const rawWindows = Array.isArray(condition.windows)
      ? condition.windows
      : [];
    const windows = rawWindows
      .slice(0, 4)
      .map((item, index) => {
        const window = this.conditionReader.asRecord(item);
        if (!Object.keys(window).length) return null;
        return {
          label:
            this.conditionReader.readString(window.label) ||
            `窗口 ${index + 1}`,
          windowMinutes: readPositiveInt(
            window.windowMinutes,
            index === 0 ? 60 : 360,
            30,
            43200,
          ),
          targetPercent: this.conditionReader.readPercent(
            window.targetPercent,
            fallbackTargetPercent,
            50,
            99.99,
          ),
          burnRateThreshold: this.conditionReader.readPercent(
            window.burnRateThreshold,
            fallbackBurnRateThreshold,
            0.1,
            100,
          ),
        };
      })
      .filter((window): window is ServiceSloWindowSpec => Boolean(window));

    return windows.length > 0
      ? windows
      : [
          {
            label: "主窗口",
            windowMinutes: readPositiveInt(
              condition.windowMinutes,
              1440,
              30,
              43200,
            ),
            targetPercent: fallbackTargetPercent,
            burnRateThreshold: fallbackBurnRateThreshold,
          },
        ];
  }

  readMatchPolicy(
    condition: Record<string, unknown>,
    windowCount: number,
  ): ServiceSloMatchPolicy {
    const policy = this.conditionReader.readString(condition.matchPolicy);
    if (policy === "all" || policy === "any") {
      return policy;
    }
    const strategy = this.conditionReader.readString(condition.strategy);
    return strategy === "multi_window_burn_rate" && windowCount > 1
      ? "all"
      : "any";
  }

  evaluateWindow(
    signals: ServiceSloWindowSignals,
    window: ServiceSloWindowSpec,
    generatedAt: Date,
  ): ServiceSloWindowEvaluation {
    const from = new Date(
      generatedAt.getTime() - window.windowMinutes * 60 * 1000,
    );
    const row = this.dashboardBuilder.buildRows(
      [signals.service],
      signals.deploymentRuns.filter(
        (run) => run.startedAt >= from && run.startedAt <= generatedAt,
      ),
      signals.operationRuns.filter(
        (run) => run.startedAt >= from && run.startedAt <= generatedAt,
      ),
      signals.alertEvents.filter(
        (event) => event.occurredAt >= from && event.occurredAt <= generatedAt,
      ),
      window.targetPercent,
    )[0];

    if (!row || row.sloPercent === null) {
      return {
        ...window,
        status: "no_data",
        statusReason: "窗口内暂无服务 SLO 信号",
        from,
        to: generatedAt,
        sloPercent: null,
        errorBudgetRemainingPercent: null,
        burnRate: null,
        deploymentCount: row?.deploymentCount ?? 0,
        deploymentFailureCount: row?.deploymentFailureCount ?? 0,
        operationCount: row?.operationCount ?? 0,
        operationFailureCount: row?.operationFailureCount ?? 0,
        alertImpactCount: row?.alertImpactCount ?? 0,
        criticalAlertCount: row?.criticalAlertCount ?? 0,
        breachReasons: [],
      };
    }

    const breachReasons = this.buildBreachReasons(row, window);
    return {
      ...window,
      status: breachReasons.length > 0 ? "firing" : "ok",
      statusReason:
        breachReasons.length > 0 ? breachReasons.join("；") : row.statusReason,
      from,
      to: generatedAt,
      sloPercent: row.sloPercent,
      errorBudgetRemainingPercent: row.errorBudgetRemainingPercent,
      burnRate: row.burnRate,
      deploymentCount: row.deploymentCount,
      deploymentFailureCount: row.deploymentFailureCount,
      operationCount: row.operationCount,
      operationFailureCount: row.operationFailureCount,
      alertImpactCount: row.alertImpactCount,
      criticalAlertCount: row.criticalAlertCount,
      breachReasons,
    };
  }

  formatWindowSummary(windows: ServiceSloWindowEvaluation[]) {
    return windows
      .map(
        (window) =>
          `${window.label}/${window.windowMinutes}m burn ${window.burnRate ?? "-"} 阈值 ${window.burnRateThreshold}`,
      )
      .join("，");
  }

  private buildBreachReasons(
    row: {
      criticalAlertCount: number;
      burnRate: number | null;
      sloPercent: number | null;
    },
    window: ServiceSloWindowSpec,
  ) {
    const reasons: string[] = [];
    if (row.criticalAlertCount > 0) {
      reasons.push(`${row.criticalAlertCount} 个严重服务告警`);
    }
    if (row.burnRate !== null && row.burnRate >= window.burnRateThreshold) {
      reasons.push(`burn rate ${row.burnRate} >= ${window.burnRateThreshold}`);
    }
    if (row.sloPercent !== null && row.sloPercent < window.targetPercent) {
      reasons.push(
        `SLO ${this.formatPercentValue(row.sloPercent)} < ${this.formatPercentValue(window.targetPercent)}`,
      );
    }
    return reasons;
  }

  private formatPercentValue(value: number) {
    return `${Number(value.toFixed(2))}%`;
  }
}
