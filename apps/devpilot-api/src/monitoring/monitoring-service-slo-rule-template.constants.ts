import type { ServiceSloRuleTemplate } from "./monitoring-service-slo-rule-template.types";

export const serviceSloRuleTemplates: ServiceSloRuleTemplate[] = [
  {
    id: "standard_api_availability",
    name: "标准 API 可用性",
    description:
      "99% SLO，最近 24 小时单窗口，适合大多数业务 API 的第一条可用性告警。",
    targetType: "service_slo",
    category: "service",
    metric: "service_slo_breach",
    severity: "warning",
    evaluationMode: "schedule",
    intervalSeconds: 300,
    condition: {
      strategy: "single_window",
      windowMinutes: 1440,
      targetPercent: 99,
      burnRateThreshold: 1,
      dedupeWindowMinutes: 30,
    },
  },
  {
    id: "high_reliability_burn_rate",
    name: "高可靠短长窗口",
    description:
      "99.9% SLO，短窗口和长窗口同时触发才告警，适合核心链路减少误报。",
    targetType: "service_slo",
    category: "service",
    metric: "service_slo_breach",
    severity: "critical",
    evaluationMode: "schedule",
    intervalSeconds: 300,
    condition: {
      strategy: "multi_window_burn_rate",
      matchPolicy: "all",
      targetPercent: 99.9,
      dedupeWindowMinutes: 30,
      windows: [
        {
          label: "短窗口",
          windowMinutes: 60,
          targetPercent: 99.9,
          burnRateThreshold: 14,
        },
        {
          label: "长窗口",
          windowMinutes: 360,
          targetPercent: 99.9,
          burnRateThreshold: 6,
        },
      ],
    },
  },
  {
    id: "error_budget_guardrail",
    name: "错误预算保护线",
    description:
      "最近 7 天错误预算低于 25% 时告警，适合在真正违约前提醒收敛变更。",
    targetType: "service_error_budget",
    category: "service",
    metric: "service_error_budget",
    severity: "warning",
    evaluationMode: "schedule",
    intervalSeconds: 300,
    condition: {
      windowMinutes: 10080,
      targetPercent: 99,
      remainingThresholdPercent: 25,
      dedupeWindowMinutes: 60,
    },
  },
  {
    id: "error_budget_exhaustion_forecast",
    name: "错误预算耗尽预测",
    description:
      "按最近 24 小时 burn rate 预测 24 小时内是否会耗尽错误预算，适合提前收敛发布风险。",
    targetType: "service_error_budget_exhaustion",
    category: "service",
    metric: "service_error_budget_exhaustion",
    severity: "critical",
    evaluationMode: "schedule",
    intervalSeconds: 300,
    condition: {
      windowMinutes: 1440,
      targetPercent: 99,
      exhaustionWithinMinutes: 1440,
      dedupeWindowMinutes: 60,
    },
  },
];
