import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import {
  evaluated,
  record,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";

const OBSERVABILITY_TTL_MS = 15 * 60 * 1000;
const PROMOTION_METRIC_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ReleaseGateObservabilityCapabilityProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "production_observability";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M13"];

  available(
    _capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    return Boolean(context.promote?.logRuns.length
      || context.promote?.metrics.length
      || context.promote?.alerts.length);
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    return definition.id === "D18"
      ? this.coverage(context, now)
      : this.promotionMetrics(context, now);
  }

  private coverage(context: ReleaseGateEvidenceContext, now: Date) {
    const logRun = context.promote?.logRuns[0];
    const metric = context.promote?.metrics[0];
    const coverage = record(metric?.raw).observability;
    if (!logRun || !metric || !coverage) {
      return unavailable(
        "observability_provider_missing",
        "缺少日志、指标、Trace 与告警的组合 Provider 证据",
        "Combined logs, metrics, trace, and alert provider evidence is missing",
      );
    }
    const complete = record(coverage);
    const checked = logRun.status === "completed" && !logRun.dryRun
      && complete.metrics === true && complete.traces === true
      && complete.alerts === true;
    return evaluated({
      status: checked ? "checked" : "blocked",
      reasonCode: checked ? "observability_coverage_complete" : "observability_coverage_incomplete",
      zh: checked ? "日志、指标、Trace 与告警均有真实覆盖" : "可观测性覆盖不完整或日志采集未真实完成",
      en: checked ? "Logs, metrics, traces, and alerts have real coverage" : "Observability coverage is incomplete or log collection did not complete",
      evidenceRef: `log-collection:${logRun.id};resource-metric:${metric.id}`,
      checkedAt: metric.sampledAt,
      ttlMs: OBSERVABILITY_TTL_MS,
      now,
    });
  }

  private promotionMetrics(context: ReleaseGateEvidenceContext, now: Date) {
    const metric = context.promote?.metrics[0];
    const evidence = record(record(metric?.raw).promotionMetrics);
    if (!metric || Object.keys(evidence).length === 0) {
      return unavailable(
        "promotion_metrics_provider_missing",
        "没有错误率、延迟和业务指标分析证据",
        "No error-rate, latency, and business-metric analysis evidence exists",
      );
    }
    const status = evidence.status === "stable" ? "checked"
      : evidence.status === "failed" ? "blocked" : "unchecked";
    return evaluated({
      status,
      reasonCode: status === "checked" ? "promotion_metrics_stable"
        : status === "blocked" ? "promotion_metrics_failed" : "promotion_metrics_inconclusive",
      zh: status === "checked" ? "错误率、延迟和业务指标稳定"
        : status === "blocked" ? "指标超过发布阈值" : "指标分析无结论",
      en: status === "checked" ? "Error rate, latency, and business metrics are stable"
        : status === "blocked" ? "Metrics exceeded release thresholds" : "Metric analysis is inconclusive",
      evidenceRef: `resource-metric:${metric.id}#promotion`,
      checkedAt: metric.sampledAt,
      ttlMs: PROMOTION_METRIC_TTL_MS,
      now,
    });
  }
}
