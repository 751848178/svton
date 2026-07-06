import { Injectable } from "@nestjs/common";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";

@Injectable()
export class MonitoringAlertBackupStatusEvaluationService {
  constructor(
    private readonly result: MonitoringAlertEvaluationResultService,
  ) {}

  evaluate(rule: AlertRuleRecord): AlertEvaluationResult {
    const backupPlan = rule.backupPlan;

    if (!backupPlan) {
      return this.result.insufficient(rule, "规则未绑定备份计划", {});
    }

    const value = {
      backupPlanId: backupPlan.id,
      backupPlanName: backupPlan.name,
      planStatus: backupPlan.status,
      lastStatus: backupPlan.lastStatus,
      lastRunAt: backupPlan.lastRunAt,
    };

    if (!backupPlan.lastStatus) {
      return this.result.insufficient(
        rule,
        `备份计划 ${backupPlan.name} 尚无运行记录`,
        value,
      );
    }

    if (["failed", "blocked"].includes(backupPlan.lastStatus)) {
      return this.result.firing(
        rule,
        `备份计划 ${backupPlan.name} 最近运行 ${backupPlan.lastStatus}`,
        value,
      );
    }

    return this.result.ok(
      rule,
      `备份计划 ${backupPlan.name} 最近运行正常`,
      value,
    );
  }
}
