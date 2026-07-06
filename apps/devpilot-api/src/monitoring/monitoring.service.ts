import { Injectable } from "@nestjs/common";
import { EvaluateAlertRuleDto } from "./dto/monitoring.dto";
import { MonitoringAlertEvaluationDispatchService } from "./monitoring-alert-evaluation-dispatch.service";
import { MonitoringAlertEvaluationEventService } from "./monitoring-alert-evaluation-event.service";
import { MonitoringAlertRuleService } from "./monitoring-alert-rule.service";

@Injectable()
export class MonitoringService {
  constructor(
    private readonly alertRuleService: MonitoringAlertRuleService,
    private readonly alertEvaluationEventService: MonitoringAlertEvaluationEventService,
    private readonly alertEvaluationDispatchService: MonitoringAlertEvaluationDispatchService,
  ) {}

  async evaluateRule(
    teamId: string,
    userId: string | null,
    ruleId: string,
    dto: EvaluateAlertRuleDto,
  ) {
    const rule = await this.alertRuleService.getRule(teamId, ruleId);

    if (!rule.enabled) {
      return this.alertEvaluationEventService.recordDisabledRule(rule);
    }

    const evaluation = await this.alertEvaluationDispatchService.evaluate(
      rule,
      dto.observedValue || {},
    );
    return this.alertEvaluationEventService.recordEvaluation(
      teamId,
      userId,
      rule,
      evaluation,
    );
  }
}
