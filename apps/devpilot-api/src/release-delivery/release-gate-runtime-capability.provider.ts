import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGateStatus,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import {
  evaluated,
  record,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";

const CONNECTIVITY_TTL_MS = 15 * 60 * 1000;
const METRIC_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ReleaseGateRuntimeCapabilityProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "environment_runtime_evidence";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M07", "M08"];

  available(
    capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    const deploy = context.deploy;
    if (capabilityId === "M08") return Boolean(deploy?.metrics.length);
    return Boolean(
      deploy?.environment
      && (deploy.deployments.length
        || deploy.connections.length
        || deploy.environment.serverBindings.length),
    );
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    if (definition.capabilityId === "M08") return this.capacity(context, now);
    if (definition.id === "D01") return this.target(context, now);
    if (definition.id === "D07") return this.server(context, now);
    if (definition.id === "D08") return this.resources(context, now);
    return unavailable(
      "network_policy_provider_missing",
      "未连接网络策略与服务发现 Provider",
      "No network-policy or service-discovery provider is connected",
    );
  }

  private target(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.deploy?.environment;
    if (!environment) {
      return unavailable("staging_environment_missing", "Staging 环境不存在", "The Staging environment does not exist");
    }
    const deployment = context.deploy?.deployments[0];
    if (!deployment) {
      return evaluated({
        status: "unchecked", reasonCode: "deployment_target_not_observed",
        zh: "Staging 已绑定，但当前发布单尚无真实部署目标运行",
        en: "Staging is bound, but this release order has no real deployment-target run",
        evidenceRef: `environment:${environment.id}`,
        checkedAt: environment.currentConfigRevision?.createdAt ?? new Date(0),
        now,
      });
    }
    const scoped = deployment.environmentId === environment.id;
    const checked = scoped && deployment.status === "completed"
      && !deployment.dryRun && Boolean(deployment.artifactManifestId);
    const status: ReleaseGateStatus = checked
      ? "checked" : deployment.status === "failed" || !scoped ? "blocked" : "unchecked";
    return evaluated({
      status,
      reasonCode: checked ? "deployment_target_bound"
        : !scoped ? "deployment_environment_mismatch"
          : deployment.status === "failed" ? "deployment_target_failed" : "deployment_target_unverified",
      zh: checked
        ? `Staging 通过真实 ${deployment.targetType} DeploymentRun 绑定精确制品`
        : "部署目标运行失败、dry-run、缺少制品或环境归属不符",
      en: checked
        ? `Staging is bound to an exact artifact by a real ${deployment.targetType} DeploymentRun`
        : "The deployment target run failed, is dry-run, lacks an artifact, or has wrong environment ownership",
      evidenceRef: `deployment-run:${deployment.id};environment:${environment.id}`,
      checkedAt: deployment.finishedAt ?? deployment.createdAt,
      now,
    });
  }

  private server(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.deploy?.environment;
    const binding = environment?.serverBindings[0];
    if (!environment || !binding) {
      return unavailable(
        "server_connectivity_provider_missing",
        "Staging 未绑定可提供连通证据的服务器或集群",
        "Staging has no server or cluster binding that can provide connectivity evidence",
      );
    }
    return evaluated({
      status: binding.server.status === "online" ? "checked" : "blocked",
      reasonCode: binding.server.status === "online" ? "server_online" : "server_not_online",
      zh: binding.server.status === "online" ? "环境绑定服务器在线" : "环境绑定服务器不在线",
      en: binding.server.status === "online" ? "The environment-bound server is online" : "The environment-bound server is not online",
      evidenceRef: `server-binding:${binding.id};server:${binding.server.id}`,
      checkedAt: binding.server.updatedAt,
      ttlMs: CONNECTIVITY_TTL_MS,
      now,
    });
  }

  private resources(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.deploy?.environment;
    const resources = context.deploy?.resources
      .filter((item) => item.kind === "managed_resource") ?? [];
    if (!environment || resources.length === 0) {
      return unavailable(
        "resource_connectivity_not_applicable",
        "当前配置没有可探测的数据库或中间件资源引用",
        "Current config has no database or middleware resource reference to probe",
      );
    }
    const runs = resources.map((resource) => context.deploy?.connections
      .find((run) => run.resourceId === resource.id));
    if (runs.some((run) => !run)) {
      return unavailable(
        "resource_connection_run_missing",
        "至少一个资源引用没有真实连接探测运行",
        "At least one resource reference has no real connection probe run",
      );
    }
    const invalidScope = runs.some((run) => run?.environmentId !== environment.id);
    const failed = runs.some((run) => run?.status === "failed" || run?.status === "blocked");
    const dryRun = runs.some((run) => run?.dryRun);
    const status: ReleaseGateStatus = invalidScope || failed
      ? "blocked" : dryRun ? "unchecked" : "checked";
    const checkedAt = runs.reduce((oldest, run) => {
      const value = run?.finishedAt ?? run?.createdAt ?? oldest;
      return value.getTime() < oldest.getTime() ? value : oldest;
    }, new Date(8640000000000000));
    return evaluated({
      status,
      reasonCode: invalidScope ? "resource_environment_mismatch"
        : failed ? "resource_connection_failed"
          : dryRun ? "resource_connection_dry_run" : "resource_connections_succeeded",
      zh: status === "checked" ? `${resources.length} 个资源连接真实探测成功` : "资源连接探测失败、dry-run 或环境归属不符",
      en: status === "checked" ? `${resources.length} resource connection probe(s) succeeded` : "A resource connection probe failed, is dry-run, or has wrong environment ownership",
      evidenceRef: runs.map((run) => `resource-connection:${run?.id}`).join(";"),
      checkedAt,
      ttlMs: CONNECTIVITY_TTL_MS,
      now,
    });
  }

  private capacity(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.deploy?.environment;
    const metric = context.deploy?.metrics[0];
    if (!environment || !metric) {
      return unavailable("capacity_metric_missing", "没有环境容量快照", "No environment capacity snapshot is available");
    }
    const fit = record(metric.raw).capacityFit;
    const status: ReleaseGateStatus = metric.environmentId !== environment.id
      ? "blocked" : fit === true ? "checked" : fit === false ? "blocked" : "unchecked";
    return evaluated({
      status,
      reasonCode: metric.environmentId !== environment.id ? "metric_environment_mismatch"
        : fit === true ? "capacity_fit" : fit === false ? "capacity_insufficient" : "capacity_fit_not_evaluated",
      zh: fit === true ? "容量快照确认可容纳本次发布" : fit === false ? "容量不足以容纳本次发布" : "已采集指标，但未计算本次发布容量需求",
      en: fit === true ? "Capacity snapshot confirms the release fits" : fit === false ? "Capacity is insufficient for the release" : "Metrics exist, but release capacity fit was not evaluated",
      evidenceRef: `resource-metric:${metric.id};environment:${environment.id}`,
      checkedAt: metric.sampledAt,
      ttlMs: METRIC_TTL_MS,
      now,
    });
  }
}
