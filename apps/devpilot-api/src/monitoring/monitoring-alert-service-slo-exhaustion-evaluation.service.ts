import { Injectable } from "@nestjs/common";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { MonitoringAlertServiceSloBudgetWindowService } from "./monitoring-alert-service-slo-budget-window.service";
import { MonitoringAlertServiceSloConditionService } from "./monitoring-alert-service-slo-condition.service";
import { readPositiveInt } from "./monitoring-number.utils";

@Injectable()
export class MonitoringAlertServiceSloExhaustionEvaluationService {
  constructor(
    private readonly result: MonitoringAlertEvaluationResultService,
    private readonly conditionReader: MonitoringAlertServiceSloConditionService,
    private readonly budgetWindowService: MonitoringAlertServiceSloBudgetWindowService,
  ) {}

  async evaluate(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    if (!rule.applicationServiceId) {
      return this.result.insufficient(rule, "规则未绑定服务目标", {});
    }

    const condition = this.conditionReader.asRecord(rule.condition);
    const windowMinutes = readPositiveInt(
      condition.windowMinutes,
      1440,
      30,
      43200,
    );
    const targetPercent = this.conditionReader.readPercent(
      condition.targetPercent,
      99,
      50,
      99.99,
    );
    const exhaustionWithinMinutes = readPositiveInt(
      condition.exhaustionWithinMinutes,
      1440,
      30,
      43200,
    );
    const loaded = await this.budgetWindowService.loadWindow(
      rule,
      windowMinutes,
      targetPercent,
      "错误预算耗尽预测",
    );

    if (!loaded) {
      return this.result.insufficient(rule, "服务目标不存在", {
        serviceId: rule.applicationServiceId,
        windowMinutes,
        targetPercent,
        exhaustionWithinMinutes,
      });
    }

    const burnRate = loaded.window.burnRate ?? 0;
    const errorBudgetRemainingPercent =
      loaded.window.errorBudgetRemainingPercent;
    const budgetConsumptionPercentPerMinute =
      burnRate > 0 ? (burnRate * 100) / windowMinutes : 0;
    const projectedExhaustionMinutes =
      errorBudgetRemainingPercent === null
        ? null
        : errorBudgetRemainingPercent <= 0
          ? 0
          : budgetConsumptionPercentPerMinute > 0
            ? Math.ceil(
                errorBudgetRemainingPercent / budgetConsumptionPercentPerMinute,
              )
            : null;
    const value = this.budgetWindowService.buildBaseValue(loaded, {
      exhaustionWithinMinutes,
      projectedExhaustionMinutes,
      budgetConsumptionPercentPerMinute: Number(
        budgetConsumptionPercentPerMinute.toFixed(4),
      ),
      errorBudgetRemainingPercent,
    });

    if (
      loaded.window.sloPercent === null ||
      errorBudgetRemainingPercent === null
    ) {
      return this.result.insufficient(
        rule,
        `${loaded.serviceName} 在最近 ${windowMinutes} 分钟内暂无错误预算耗尽预测信号`,
        value,
      );
    }

    if (projectedExhaustionMinutes === 0) {
      return this.result.firing(
        rule,
        `${loaded.serviceName} 错误预算已耗尽，当前 burn rate ${loaded.window.burnRate ?? 0}`,
        value,
      );
    }

    if (
      projectedExhaustionMinutes !== null &&
      projectedExhaustionMinutes <= exhaustionWithinMinutes
    ) {
      return this.result.firing(
        rule,
        `${loaded.serviceName} 错误预算预计 ${projectedExhaustionMinutes} 分钟内耗尽，阈值 ${exhaustionWithinMinutes} 分钟`,
        value,
      );
    }

    if (projectedExhaustionMinutes === null) {
      return this.result.ok(
        rule,
        `${loaded.serviceName} 当前没有错误预算消耗，剩余 ${this.budgetWindowService.formatPercentValue(errorBudgetRemainingPercent)}`,
        value,
      );
    }

    return this.result.ok(
      rule,
      `${loaded.serviceName} 错误预算预计 ${projectedExhaustionMinutes} 分钟后耗尽，高于阈值 ${exhaustionWithinMinutes} 分钟`,
      value,
    );
  }
}
