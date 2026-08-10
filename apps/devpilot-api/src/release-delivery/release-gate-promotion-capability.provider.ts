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
const HTTP_PROBE_TTL_MS = 15 * 60 * 1000;
@Injectable()
export class ReleaseGatePromotionCapabilityProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "production_workload_probe";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M12"];

  available(
    _capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    return Boolean(context.promote?.releaseRun?.deploymentRuns.length);
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    if (definition.id === "D17") return this.healthConfig(context, now);
    if (definition.id === "P01") return this.workload(context, now);
    if (definition.id === "P02") return this.http(context, now);
    return this.businessValidation(context, now);
  }

  private healthConfig(context: ReleaseGateEvidenceContext, now: Date) {
    const deployment = context.promote?.releaseRun?.deploymentRuns[0];
    if (!deployment) {
      return unavailable("production_deployment_missing", "没有 Production DeploymentRun", "No Production DeploymentRun exists");
    }
    const health = record(record(deployment.result).healthProbe);
    const configured = Boolean(deployment.healthCheckUrl)
      || Object.keys(health).length > 0;
    if (!configured) {
      return unavailable(
        "health_probe_provider_missing",
        "Production 部署未提供启动或健康探针配置",
        "Production deployment has no startup or health-probe configuration",
      );
    }
    const status = normalizeTechnicalStatus(health.status);
    return evaluated({
      status,
      reasonCode: status === "checked" ? "health_probe_passed"
        : status === "blocked" ? "health_probe_failed" : "health_probe_not_executed",
      zh: status === "checked" ? "启动与健康探针通过" : status === "blocked" ? "启动或健康探针失败" : "探针已配置但尚无执行结论",
      en: status === "checked" ? "Startup and health probes passed" : status === "blocked" ? "Startup or health probe failed" : "Probe is configured but has no execution conclusion",
      evidenceRef: `deployment-run:${deployment.id}#health`,
      checkedAt: deployment.finishedAt ?? deployment.createdAt,
      now,
    });
  }

  private workload(context: ReleaseGateEvidenceContext, now: Date) {
    const environment = context.promote?.environment;
    const run = context.promote?.releaseRun;
    const deployment = run?.deploymentRuns[0];
    const version = environment?.currentEnvironmentVersion;
    if (!environment || !run || !deployment || !version) {
      return unavailable(
        "production_workload_evidence_missing",
        "Production 当前版本或部署运行证据不完整",
        "Production current-version or deployment-run evidence is incomplete",
      );
    }
    const readiness = record(record(deployment.result).workloadReady);
    if (Object.keys(readiness).length === 0) {
      return unavailable(
        "workload_readiness_provider_missing",
        "Production 部署完成，但没有实例或工作负载就绪 Provider 结论",
        "Production deployment completed, but no instance/workload readiness provider conclusion exists",
      );
    }
    const scoped = deployment.environmentId === environment.id
      && version.deploymentRunId === deployment.id
      && version.artifactManifestId === run.artifactManifestId;
    const checked = scoped && run.status === "succeeded"
      && deployment.status === "completed" && !deployment.dryRun
      && (readiness.status === "passed" || readiness.status === "succeeded");
    return evaluated({
      status: checked ? "checked" : "blocked",
      reasonCode: checked ? "production_workload_ready" : "production_workload_mismatch",
      zh: checked ? "Production 工作负载已由成功精确制品运行生成当前版本" : "Production 工作负载、制品或当前版本不一致",
      en: checked ? "Production workload current version comes from a successful exact-artifact run" : "Production workload, artifact, or current version is inconsistent",
      evidenceRef: `environment-version:${version.id};deployment-run:${deployment.id}`,
      checkedAt: version.effectiveAt,
      now,
    });
  }

  private http(context: ReleaseGateEvidenceContext, now: Date) {
    const deployment = context.promote?.releaseRun?.deploymentRuns[0];
    const probe = record(record(deployment?.result).httpProbe);
    if (!deployment || Object.keys(probe).length === 0) {
      return unavailable(
        "http_probe_provider_missing",
        "没有 Production HTTP 可访问性探测证据",
        "No Production HTTP accessibility-probe evidence exists",
      );
    }
    const status = normalizeTechnicalStatus(probe.status);
    return evaluated({
      status,
      reasonCode: status === "checked" ? "http_probe_passed" : status === "blocked" ? "http_probe_failed" : "http_probe_inconclusive",
      zh: status === "checked" ? "Production HTTP 探测通过" : status === "blocked" ? "Production HTTP 探测失败" : "Production HTTP 探测无结论",
      en: status === "checked" ? "Production HTTP probe passed" : status === "blocked" ? "Production HTTP probe failed" : "Production HTTP probe is inconclusive",
      evidenceRef: `deployment-run:${deployment.id}#http`,
      checkedAt: deployment.finishedAt ?? deployment.createdAt,
      ttlMs: HTTP_PROBE_TTL_MS,
      now,
    });
  }

  private businessValidation(context: ReleaseGateEvidenceContext, now: Date) {
    const deployment = context.promote?.releaseRun?.deploymentRuns[0];
    if (!deployment) {
      return unavailable("business_validation_target_missing", "没有可验证的 Production 工作负载", "No Production workload exists for business validation");
    }
    return evaluated({
      status: "manual",
      reasonCode: "business_validation_manual_evidence",
      zh: "关键业务验证是独立人工证据，不替代 HTTP、健康或指标技术门禁",
      en: "Critical business validation is separate manual evidence and does not replace HTTP, health, or metric technical gates",
      evidenceRef: `deployment-run:${deployment.id}#business-validation`,
      checkedAt: deployment.finishedAt ?? deployment.createdAt,
      now,
    });
  }

}

function normalizeTechnicalStatus(value: unknown): ReleaseGateStatus {
  if (value === "passed" || value === "succeeded") return "checked";
  if (value === "failed" || value === "blocked") return "blocked";
  return "unchecked";
}
