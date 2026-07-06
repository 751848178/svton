import { Injectable } from '@nestjs/common';
import type { AlertRuleRecord } from './monitoring-alert-rule.types';
import type { AlertEvaluationResult } from './monitoring-alert-evaluation.types';

@Injectable()
export class MonitoringAlertEvaluationResultService {
  ok(rule: AlertRuleRecord, summary: string, value: Record<string, unknown>): AlertEvaluationResult {
    return {
      status: 'ok',
      eventStatus: 'resolved',
      summary,
      value,
      metadata: this.eventMetadata(rule),
    };
  }

  firing(rule: AlertRuleRecord, summary: string, value: Record<string, unknown>): AlertEvaluationResult {
    return {
      status: 'firing',
      eventStatus: 'firing',
      summary,
      value,
      metadata: this.eventMetadata(rule),
    };
  }

  insufficient(rule: AlertRuleRecord, summary: string, value: Record<string, unknown>): AlertEvaluationResult {
    return {
      status: 'insufficient_data',
      eventStatus: 'insufficient_data',
      summary,
      value,
      metadata: this.eventMetadata(rule),
    };
  }

  private eventMetadata(rule: AlertRuleRecord) {
    return {
      evaluationMode: rule.evaluationMode,
      intervalSeconds: rule.intervalSeconds,
      ruleName: rule.name,
    };
  }
}
