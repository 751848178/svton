import { Injectable } from "@nestjs/common";
import { MonitoringAlertDeploymentSmokeCheckEvaluationService } from "./monitoring-alert-deployment-smoke-check-evaluation.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { MonitoringAlertSiteSmokeCheckEvaluationService } from "./monitoring-alert-site-smoke-check-evaluation.service";

@Injectable()
export class MonitoringAlertSmokeCheckEvaluationService {
  constructor(
    private readonly siteSmokeEvaluator: MonitoringAlertSiteSmokeCheckEvaluationService,
    private readonly deploymentSmokeEvaluator: MonitoringAlertDeploymentSmokeCheckEvaluationService,
  ) {}

  evaluateSiteSmokeCheckFailure(
    rule: AlertRuleRecord,
  ): Promise<AlertEvaluationResult> {
    return this.siteSmokeEvaluator.evaluate(rule);
  }

  evaluateDeploymentSmokeCheckFailure(
    rule: AlertRuleRecord,
  ): Promise<AlertEvaluationResult> {
    return this.deploymentSmokeEvaluator.evaluate(rule);
  }
}
