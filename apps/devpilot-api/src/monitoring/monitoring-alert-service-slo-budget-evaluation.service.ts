import { Injectable } from "@nestjs/common";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { MonitoringAlertServiceSloBudgetWindowService } from "./monitoring-alert-service-slo-budget-window.service";
import { MonitoringAlertServiceSloConditionService } from "./monitoring-alert-service-slo-condition.service";
import { readPositiveInt } from "./monitoring-number.utils";

@Injectable()
export class MonitoringAlertServiceSloBudgetEvaluationService {
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
    const remainingThresholdPercent = this.conditionReader.readPercent(
      condition.remainingThresholdPercent,
      25,
      0,
      100,
    );
    const loaded = await this.budgetWindowService.loadWindow(
      rule,
      windowMinutes,
      targetPercent,
      "错误预算",
    );

    if (!loaded) {
      return this.result.insufficient(rule, "服务目标不存在", {
        serviceId: rule.applicationServiceId,
        windowMinutes,
        targetPercent,
        remainingThresholdPercent,
      });
    }

    const value = this.budgetWindowService.buildBaseValue(loaded, {
      remainingThresholdPercent,
    });
    if (
      loaded.window.sloPercent === null ||
      loaded.window.errorBudgetRemainingPercent === null
    ) {
      return this.result.insufficient(
        rule,
        `${loaded.serviceName} 在最近 ${windowMinutes} 分钟内暂无错误预算信号`,
        value,
      );
    }

    if (
      loaded.window.errorBudgetRemainingPercent <= remainingThresholdPercent
    ) {
      return this.result.firing(
        rule,
        `${loaded.serviceName} 错误预算剩余 ${this.budgetWindowService.formatPercentValue(loaded.window.errorBudgetRemainingPercent)} 低于阈值 ${this.budgetWindowService.formatPercentValue(remainingThresholdPercent)}`,
        value,
      );
    }

    return this.result.ok(
      rule,
      `${loaded.serviceName} 错误预算剩余 ${this.budgetWindowService.formatPercentValue(loaded.window.errorBudgetRemainingPercent)} 高于阈值 ${this.budgetWindowService.formatPercentValue(remainingThresholdPercent)}`,
      value,
    );
  }
}
