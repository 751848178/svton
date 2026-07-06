import { Injectable } from '@nestjs/common';
import type { AlertEvaluationResult } from './monitoring-alert-evaluation.types';
import { MonitoringAlertEvaluationResultService } from './monitoring-alert-evaluation-result.service';
import type { AlertRuleRecord } from './monitoring-alert-rule.types';

type StatusTarget = {
  id: string;
  name: string;
  status: string;
};

@Injectable()
export class MonitoringAlertStatusEvaluationService {
  constructor(private readonly result: MonitoringAlertEvaluationResultService) {}

  evaluateObservedValue(rule: AlertRuleRecord, observedValue: Record<string, unknown>): AlertEvaluationResult {
    const condition = this.asRecord(rule.condition);
    const expectedStatuses = this.readStringArray(condition.expectedStatuses);
    const status = this.readString(observedValue.status);

    if (!status) {
      return this.result.insufficient(rule, '手动观测值缺少 status 字段', observedValue);
    }

    const expected =
      expectedStatuses.length > 0 ? expectedStatuses : ['ok', 'active', 'running', 'online', 'completed'];
    if (expected.includes(status)) {
      return this.result.ok(rule, `观测值 ${status} 符合预期`, observedValue);
    }

    return this.result.firing(rule, `观测值 ${status} 不符合预期`, observedValue);
  }

  evaluateTarget(
    rule: AlertRuleRecord,
    target: StatusTarget | null,
    defaultExpectedStatuses: string[],
    label: string,
  ): AlertEvaluationResult {
    if (!target) {
      return this.result.insufficient(rule, `规则未绑定${label}目标`, {});
    }

    const condition = this.asRecord(rule.condition);
    const expectedStatuses = this.readStringArray(condition.expectedStatuses);
    const expected = expectedStatuses.length > 0 ? expectedStatuses : defaultExpectedStatuses;
    const value = {
      targetId: target.id,
      targetName: target.name,
      status: target.status,
      expectedStatuses: expected,
    };

    if (expected.includes(target.status)) {
      return this.result.ok(rule, `${label}正常: ${target.name} 为 ${target.status}`, value);
    }

    return this.result.firing(rule, `${label}异常: ${target.name} 为 ${target.status}`, value);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private readStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  }
}
