export type ServiceSloRuleTemplate = {
  id: string;
  name: string;
  description: string;
  targetType:
    | "service_slo"
    | "service_error_budget"
    | "service_error_budget_exhaustion";
  category: "service";
  metric:
    | "service_slo_breach"
    | "service_error_budget"
    | "service_error_budget_exhaustion";
  severity: "warning" | "critical";
  evaluationMode: "schedule";
  intervalSeconds: number;
  condition: Record<string, unknown>;
};
