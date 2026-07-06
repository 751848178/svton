import { Injectable } from "@nestjs/common";
import { serviceSloRuleTemplates } from "./monitoring-service-slo-rule-template.constants";
import type { ServiceSloRuleTemplate } from "./monitoring-service-slo-rule-template.types";

@Injectable()
export class MonitoringServiceSloRuleTemplateService {
  listTemplates(): ServiceSloRuleTemplate[] {
    return serviceSloRuleTemplates.map(
      (template) =>
        JSON.parse(JSON.stringify(template)) as ServiceSloRuleTemplate,
    );
  }
}
