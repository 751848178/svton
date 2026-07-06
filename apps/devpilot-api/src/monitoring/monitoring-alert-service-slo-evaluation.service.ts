import { Injectable } from "@nestjs/common";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { MonitoringAlertServiceSloBreachEvaluationService } from "./monitoring-alert-service-slo-breach-evaluation.service";
import { MonitoringAlertServiceSloBudgetEvaluationService } from "./monitoring-alert-service-slo-budget-evaluation.service";
import { MonitoringAlertServiceSloExhaustionEvaluationService } from "./monitoring-alert-service-slo-exhaustion-evaluation.service";

@Injectable()
export class MonitoringAlertServiceSloEvaluationService {
  constructor(
    private readonly breachEvaluator: MonitoringAlertServiceSloBreachEvaluationService,
    private readonly budgetEvaluator: MonitoringAlertServiceSloBudgetEvaluationService,
    private readonly exhaustionEvaluator: MonitoringAlertServiceSloExhaustionEvaluationService,
  ) {}

  evaluateBreach(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    return this.breachEvaluator.evaluate(rule);
  }

  evaluateErrorBudget(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    return this.budgetEvaluator.evaluate(rule);
  }

  evaluateErrorBudgetExhaustion(
    rule: AlertRuleRecord,
  ): Promise<AlertEvaluationResult> {
    return this.exhaustionEvaluator.evaluate(rule);
  }
}
