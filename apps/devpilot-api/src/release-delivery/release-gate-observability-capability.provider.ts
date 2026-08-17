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
import { evaluateFrozenObservabilityConfig } from "./release-gate-observability-config.policy";

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
    const deployment = exactDeployment(context);
    const result = record(deployment?.result);
    return Boolean(context.promote?.logRuns.length
      || context.promote?.metrics.length
      || context.promote?.alerts.length
      || Object.keys(record(result.observability)).length
      || Object.keys(record(result.promotionMetrics)).length);
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
    if (context.decisionCheckpoint === "production_pre_execution") {
      return evaluateFrozenObservabilityConfig(context, now);
    }
    if (context.decisionCheckpoint === "production_post_deploy") {
      const deployment = exactDeployment(context);
      const evidence = record(record(deployment?.result).observability);
      if (!deployment || Object.keys(evidence).length === 0) {
        return unavailable(
          "candidate_observability_evidence_missing",
          "精确 Production 候选缺少运行时日志、指标、Trace 与告警证据",
          "The exact Production candidate has no runtime logs, metrics, trace, and alert evidence",
        );
      }
      const localAcceptance = evidence.profile === "local_acceptance_v1" &&
        evidence.acceptanceOnly === true &&
        evidence.applicabilityPolicy === "local-single-host-acceptance-v1";
      const complete = evidence.logs === "observed" &&
        evidence.metrics === "observed" &&
        evidence.traces === "not_applicable" &&
        evidence.alerts === "not_applicable" && localAcceptance &&
        evidence.deploymentInputHash === context.decisionTarget?.deploymentInputHash &&
        evidence.workloadInputHash === context.decisionTarget?.workloadInputHash;
      return evaluated({
        status: complete ? "checked" : "blocked",
        reasonCode: complete ? "candidate_observability_local_acceptance_only" : "candidate_observability_incomplete",
        zh: complete ? "精确候选具备本地验收证据（不代表外部 Production Ready）" : "精确候选的运行时可观测证据不完整",
        en: complete ? "The exact candidate has local-acceptance evidence only; this is not external Production Ready" : "Runtime observability evidence is incomplete for the exact candidate",
        evidenceRef: `deployment-run:${deployment.id}#observability`,
        checkedAt: deployment.finishedAt ?? deployment.createdAt,
        ttlMs: OBSERVABILITY_TTL_MS,
        now,
      });
    }
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
    if (context.decisionCheckpoint === "production_promote_pre_route") {
      const deployment = exactDeployment(context);
      const candidate = record(record(deployment?.result).productionCandidate);
      const evidence = record(record(deployment?.result).promotionMetrics);
      if (!deployment || candidate.candidateHash !== context.decisionTarget?.candidateHash ||
        Object.keys(evidence).length === 0) {
        return unavailable(
          "candidate_promotion_metrics_missing",
          "精确 Production 候选没有错误率、延迟与业务指标证据",
          "The exact Production candidate has no error-rate, latency, and business-metric evidence",
        );
      }
      return metricEvaluation(evidence, deployment.id, deployment.createdAt, now);
    }
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

function exactDeployment(context: ReleaseGateEvidenceContext) {
  const id = context.decisionTarget?.deploymentRunId;
  return context.promote?.releaseRun?.deploymentRuns.find(
    (deployment) => deployment.id === id,
  );
}

function metricEvaluation(
  evidence: Record<string, unknown>,
  deploymentRunId: string,
  fallback: Date,
  now: Date,
) {
  const localAcceptance = evidence.status === "technical_only" &&
    evidence.profile === "local_acceptance_v1" &&
    evidence.acceptanceOnly === true &&
    evidence.applicabilityPolicy === "local-single-host-acceptance-v1";
  const status = evidence.status === "stable" ? "checked"
    : localAcceptance ? "checked"
      : evidence.status === "failed" ? "blocked" : "unchecked";
  const parsed = typeof evidence.observedAt === "string"
    ? new Date(evidence.observedAt) : fallback;
  return evaluated({
    status,
    reasonCode: localAcceptance ? "candidate_promotion_metrics_local_acceptance_only"
      : status === "checked" ? "candidate_promotion_metrics_stable"
      : status === "blocked" ? "candidate_promotion_metrics_failed" : "candidate_promotion_metrics_inconclusive",
    zh: localAcceptance ? "精确候选仅具备本地技术信号，不代表外部 Production 指标达标"
      : status === "checked" ? "精确候选的错误率、延迟与业务指标稳定"
      : status === "blocked" ? "精确候选指标超过发布阈值" : "精确候选指标分析无结论",
    en: localAcceptance ? "The exact candidate has local technical signals only; external Production metrics are not proven"
      : status === "checked" ? "Error rate, latency, and business metrics are stable for the exact candidate"
      : status === "blocked" ? "The exact candidate exceeded metric thresholds" : "The exact candidate metric analysis is inconclusive",
    evidenceRef: `deployment-run:${deploymentRunId}#promotion-metrics`,
    checkedAt: Number.isNaN(parsed.getTime()) ? fallback : parsed,
    ttlMs: PROMOTION_METRIC_TTL_MS,
    now,
  });
}
