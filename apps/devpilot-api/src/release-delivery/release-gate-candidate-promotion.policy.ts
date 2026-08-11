import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import {
  evaluated,
  record,
  type ReleaseGateProviderResult,
  unavailable,
} from "./release-gate-provider.types";

const OBSERVATION_TTL_MS = 5 * 60 * 1000;

export function evaluateCandidatePromotionGate(
  gateId: string,
  context: ReleaseGateEvidenceContext,
  now: Date,
): ReleaseGateProviderResult | null {
  if (gateId === "P05") return observationWindow(context, now);
  if (gateId === "P06") return metricConclusion(context, now);
  if (gateId === "P09") return postRouteObservation(context, now);
  if (gateId === "P10") return evidenceRetention(context, now);
  return null;
}

function observationWindow(context: ReleaseGateEvidenceContext, now: Date) {
  const scoped = exactCandidateDeployment(context);
  const observation = record(record(scoped?.deployment.result).promotionObservation);
  if (!scoped || Object.keys(observation).length === 0) {
    return unavailable(
      "candidate_observation_window_missing",
      "精确 Production 候选缺少观察窗口与样本量证据",
      "The exact Production candidate has no observation-window or sample-size evidence",
    );
  }
  const windowSeconds = number(observation.windowSeconds);
  const minimumWindow = number(observation.minimumWindowSeconds);
  const sampleCount = number(observation.sampleCount);
  const minimumSamples = number(observation.minimumSampleCount);
  const sufficient = windowSeconds >= minimumWindow && minimumWindow > 0 &&
    sampleCount >= minimumSamples && minimumSamples > 0;
  return evaluated({
    status: sufficient ? "checked" : "blocked",
    reasonCode: sufficient ? "candidate_observation_sufficient" : "candidate_observation_insufficient",
    zh: sufficient ? "精确候选的观察时长与样本量达到冻结阈值" : "精确候选的观察时长或样本量不足",
    en: sufficient ? "The exact candidate meets the frozen observation thresholds" : "The exact candidate lacks sufficient observation time or samples",
    evidenceRef: `deployment-run:${scoped.deployment.id}#promotion-observation`,
    checkedAt: observedAt(observation, scoped.deployment.createdAt),
    ttlMs: OBSERVATION_TTL_MS,
    now,
  });
}

function metricConclusion(context: ReleaseGateEvidenceContext, now: Date) {
  const scoped = exactCandidateDeployment(context);
  const metrics = record(record(scoped?.deployment.result).promotionMetrics);
  if (!scoped || Object.keys(metrics).length === 0) {
    return unavailable(
      "candidate_metric_conclusion_missing",
      "精确 Production 候选没有指标数据结论",
      "The exact Production candidate has no metric-data conclusion",
    );
  }
  const conclusive = metrics.status === "stable" || metrics.status === "failed";
  return evaluated({
    status: conclusive ? "checked" : "manual",
    reasonCode: conclusive ? "candidate_metric_conclusion_available" : "candidate_metric_conclusion_inconclusive",
    zh: conclusive ? "精确候选的指标数据已有明确结论" : "精确候选的指标数据无结论，需要人工处置",
    en: conclusive ? "The exact candidate has a conclusive metric result" : "The exact candidate metrics are inconclusive and need manual disposition",
    evidenceRef: `deployment-run:${scoped.deployment.id}#promotion-metrics`,
    checkedAt: observedAt(metrics, scoped.deployment.createdAt),
    ttlMs: OBSERVATION_TTL_MS,
    now,
  });
}

function evidenceRetention(context: ReleaseGateEvidenceContext, now: Date) {
  const scoped = exactCandidateDeployment(context);
  const result = record(scoped?.deployment.result);
  const candidate = record(result.productionCandidate);
  const decision = record(result.postDeployGateDecision);
  const retained = scoped && candidate.candidateHash === scoped.candidateHash &&
    typeof decision.id === "string" && typeof decision.inputHash === "string";
  if (!scoped || !retained) {
    return unavailable(
      "candidate_evidence_retention_missing",
      "精确候选缺少服务端保存的冻结身份或发布后门禁引用",
      "The exact candidate lacks server-retained identity or post-deploy gate reference",
    );
  }
  return evaluated({
    status: "checked",
    reasonCode: "candidate_evidence_retained",
    zh: "精确候选身份与发布后门禁引用已由服务端留存",
    en: "The server retained the exact candidate identity and post-deploy gate reference",
    evidenceRef: `deployment-run:${scoped.deployment.id}#retained-evidence`,
    checkedAt: scoped.deployment.createdAt,
    now,
  });
}

function postRouteObservation(context: ReleaseGateEvidenceContext, now: Date) {
  const target = context.decisionTarget;
  if (context.decisionCheckpoint !== "production_post_route" ||
    !target?.releaseRunId || !target.deploymentRunId || !target.candidateHash) {
    return unavailable("post_route_candidate_missing", "缺少精确 Production route 候选", "The exact Production route candidate is missing");
  }
  const route = context.promote?.routeSwitchRuns.find((item) =>
    item.releaseRunId === target.releaseRunId && item.deploymentRunId === target.deploymentRunId);
  const result = record(route?.result);
  const probe = record(result.siteProbe);
  const http = record(probe.http);
  if (!route || route.status !== "switched" ||
    result.candidateHash !== target.candidateHash || !Object.keys(probe).length) {
    return unavailable("post_route_observation_missing", "没有绑定精确候选的全量后 route 与探测证据", "No post-route observation is bound to the exact candidate");
  }
  const stable = http.status === "passed" && number(http.statusCode) >= 200 &&
    number(http.statusCode) < 300 && record(probe.dns).status === "resolved" &&
    (String(http.finalUrl ?? "").startsWith("http://") || record(probe.tls).status === "valid");
  return evaluated({
    status: stable ? "checked" : "blocked",
    reasonCode: stable ? "post_route_candidate_stable" : "post_route_candidate_unstable",
    zh: stable ? "精确 Production 候选的全量后观测通过" : "精确 Production 候选的全量后观测失败",
    en: stable ? "Post-route observation passed for the exact Production candidate" : "Post-route observation failed for the exact Production candidate",
    evidenceRef: `site-route-switch:${route.id};candidate:${target.candidateHash}`,
    checkedAt: route.updatedAt,
    ttlMs: OBSERVATION_TTL_MS,
    now,
  });
}

function exactCandidateDeployment(context: ReleaseGateEvidenceContext) {
  const target = context.decisionTarget;
  if (!target?.deploymentRunId || !target.candidateHash) return null;
  const deployment = context.promote?.releaseRun?.deploymentRuns.find(
    (item) => item.id === target.deploymentRunId,
  );
  const candidate = record(record(deployment?.result).productionCandidate);
  return deployment && candidate.candidateHash === target.candidateHash
    ? { deployment, candidateHash: target.candidateHash }
    : null;
}

function observedAt(value: Record<string, unknown>, fallback: Date) {
  const parsed = typeof value.observedAt === "string" ? new Date(value.observedAt) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}
