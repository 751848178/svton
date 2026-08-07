import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGateStatus,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { evaluateReleaseGateDeploymentTarget } from "./release-gate-deployment-target-evaluator";
import {
  matchReleaseDeploymentTargetBindings,
} from "./release-deployment-target-match.utils";
import {
  evaluated,
  record,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";

const CONNECTIVITY_TTL_MS = 15 * 60 * 1000;
const METRIC_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ReleaseGateRuntimeCapabilityProvider implements ReleaseGateCapabilityProvider {
  readonly providerKey = "environment_runtime_evidence";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M07", "M08"];

  available(
    capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    const deploy = context.deploy;
    if (capabilityId === "M08") return Boolean(deploy?.metrics.length);
    return Boolean(
      deploy?.environment &&
      (deploy.deployments.length ||
        deploy.connections.length ||
        deploy.environment.serverBindings.length),
    );
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    if (definition.capabilityId === "M08") return this.capacity(context, now);
    if (definition.id === "D01") {
      return evaluateReleaseGateDeploymentTarget(context, now);
    }
    if (definition.id === "D07") return this.server(context, now);
    if (definition.id === "D08") return this.resources(context, now);
    return unavailable(
      "network_policy_provider_missing",
      "未连接网络策略与服务发现 Provider",
      "No network-policy or service-discovery provider is connected",
    );
  }

  private server(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.deploy?.environment;
    const bindings = environment?.serverBindings;
    if (!environment || !bindings || bindings.length === 0) {
      return unavailable(
        "server_connectivity_provider_missing",
        "Staging 未绑定可提供连通证据的服务器或集群",
        "Staging has no server or cluster binding that can provide connectivity evidence",
      );
    }
    const providerKey =
      context.decisionTarget?.providerKey ?? inferProviderKey(bindings);
    if (!providerKey) {
      return unavailable(
        "server_provider_key_unknown",
        "无法确定 Staging 部署 Provider，服务器连通证据不可用",
        "The Staging deployment provider is unknown, so server connectivity evidence is unavailable",
      );
    }
    const matches = matchReleaseDeploymentTargetBindings(bindings, providerKey);
    if (matches.length !== 1) {
      return unavailable(
        "server_provider_matched_target_missing",
        "Provider 匹配的部署目标绑定缺失或重复，服务器连通证据不可用",
        "The provider-matched deploy target binding is missing or duplicated, so server connectivity evidence is unavailable",
      );
    }
    const binding = matches[0].binding;
    const online = binding.server.status === "online";
    return evaluated({
      status: online ? "checked" : "blocked",
      reasonCode: online ? "server_online" : "server_not_online",
      zh: online
        ? "环境绑定服务器在线"
        : "环境绑定服务器不在线",
      en: online
        ? "The environment-bound server is online"
        : "The environment-bound server is not online",
      evidenceRef: `server-binding:${binding.id};server:${binding.server.id};provider:${providerKey}`,
      checkedAt: binding.server.updatedAt,
      ttlMs: CONNECTIVITY_TTL_MS,
      now,
    });
  }

  private resources(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.deploy?.environment;
    const resources =
      context.deploy?.resources.filter(
        (item) => item.kind === "managed_resource",
      ) ?? [];
    if (!environment || resources.length === 0) {
      return unavailable(
        "resource_connectivity_not_applicable",
        "当前配置没有可探测的数据库或中间件资源引用",
        "Current config has no database or middleware resource reference to probe",
      );
    }
    const runs = resources.map((resource) =>
      context.deploy?.connections.find((run) => run.resourceId === resource.id),
    );
    if (runs.some((run) => !run)) {
      return unavailable(
        "resource_connection_run_missing",
        "至少一个资源引用没有真实连接探测运行",
        "At least one resource reference has no real connection probe run",
      );
    }
    const invalidScope = runs.some(
      (run) => run?.environmentId !== environment.id,
    );
    const failed = runs.some(
      (run) => run?.status === "failed" || run?.status === "blocked",
    );
    const dryRun = runs.some((run) => run?.dryRun);
    const status: ReleaseGateStatus =
      invalidScope || failed ? "blocked" : dryRun ? "unchecked" : "checked";
    const checkedAt = runs.reduce((oldest, run) => {
      const value = run?.finishedAt ?? run?.createdAt ?? oldest;
      return value.getTime() < oldest.getTime() ? value : oldest;
    }, new Date(8640000000000000));
    return evaluated({
      status,
      reasonCode: invalidScope
        ? "resource_environment_mismatch"
        : failed
          ? "resource_connection_failed"
          : dryRun
            ? "resource_connection_dry_run"
            : "resource_connections_succeeded",
      zh:
        status === "checked"
          ? `${resources.length} 个资源连接真实探测成功`
          : "资源连接探测失败、dry-run 或环境归属不符",
      en:
        status === "checked"
          ? `${resources.length} resource connection probe(s) succeeded`
          : "A resource connection probe failed, is dry-run, or has wrong environment ownership",
      evidenceRef: runs
        .map((run) => `resource-connection:${run?.id}`)
        .join(";"),
      checkedAt,
      ttlMs: CONNECTIVITY_TTL_MS,
      now,
    });
  }

  private capacity(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.deploy?.environment;
    const metric = context.deploy?.metrics[0];
    if (!environment || !metric) {
      return unavailable(
        "capacity_metric_missing",
        "没有环境容量快照",
        "No environment capacity snapshot is available",
      );
    }
    const fit = record(metric.raw).capacityFit;
    const status: ReleaseGateStatus =
      metric.environmentId !== environment.id
        ? "blocked"
        : fit === true
          ? "checked"
          : fit === false
            ? "blocked"
            : "unchecked";
    return evaluated({
      status,
      reasonCode:
        metric.environmentId !== environment.id
          ? "metric_environment_mismatch"
          : fit === true
            ? "capacity_fit"
            : fit === false
              ? "capacity_insufficient"
              : "capacity_fit_not_evaluated",
      zh:
        fit === true
          ? "容量快照确认可容纳本次发布"
          : fit === false
            ? "容量不足以容纳本次发布"
            : "已采集指标，但未计算本次发布容量需求",
      en:
        fit === true
          ? "Capacity snapshot confirms the release fits"
          : fit === false
            ? "Capacity is insufficient for the release"
            : "Metrics exist, but release capacity fit was not evaluated",
      evidenceRef: `resource-metric:${metric.id};environment:${environment.id}`,
      checkedAt: metric.sampledAt,
      ttlMs: METRIC_TTL_MS,
      now,
    });
  }
}

function inferProviderKey(
  bindings: Array<{
    metadata: unknown;
  }>,
): string | null {
  const keys = new Set<string>();
  for (const binding of bindings) {
    const deployment = record(record(binding.metadata).releaseDeployment);
    if (typeof deployment.providerKey === "string" && deployment.providerKey) {
      keys.add(deployment.providerKey);
    }
  }
  return keys.size === 1 ? [...keys][0] : null;
}
