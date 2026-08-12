import { Injectable } from "@nestjs/common";
import { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import { ReleaseGateDecisionService } from "./release-gate-decision.service";
import { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import { ReleaseStagingExecutorPort } from "./release-staging.types";
import type { ProductionReleasePreview } from "./release-production.types";
import { ReleaseServerCapacityService } from "./release-server-capacity.service";
import { ReleaseProductionDnsProbeService } from "./release-production-dns-probe.service";
import { releaseGateCheckpointPolicy } from "./release-gate-checkpoint.policy";
import { workloadReadinessConfigured } from "./release-workload-readiness.policy";
import { productionGateRepairHref } from "./release-production-preflight-repair.model";

@Injectable()
export class ReleaseProductionPreflightService {
  constructor(
    private readonly deploymentInputs: ReleaseDeploymentInputService,
    private readonly workloads: ReleaseProductionWorkloadService,
    private readonly gates: ReleaseGateDecisionService,
    private readonly executor: ReleaseStagingExecutorPort,
    private readonly capacity: ReleaseServerCapacityService,
    private readonly dns: ReleaseProductionDnsProbeService,
  ) {}

  get providerKey() { return this.executor.providerKey; }

  async preview(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    actorId: string;
    preview: ProductionReleasePreview;
    refreshEvidence?: boolean;
  }) {
    const snapshot = input.preview.snapshot;
    const deployment = await this.deploymentInputs.prepare({
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: snapshot.environment.id,
      providerKey: this.executor.providerKey,
      configRevisionId: snapshot.config.revisionId,
      label: "Production",
    });
    const workload = await this.workloads.prepare({
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: snapshot.environment.id,
      manifestId: snapshot.manifest.id,
    });
    const workloadHealthConfigured = workloadReadinessConfigured(workload);
    const evidenceInput = {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: snapshot.environment.id,
      configRevisionId: snapshot.config.revisionId,
      buildRunId: snapshot.build.id,
      manifestId: snapshot.manifest.id,
      providerKey: this.executor.providerKey,
      deployment,
      workload,
    };
    const capacity = await (input.refreshEvidence
      ? this.capacity.collect(evidenceInput)
      : this.capacity.findFresh(evidenceInput));
    const dnsInput = {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: snapshot.environment.id,
      configRevisionId: snapshot.config.revisionId,
      routeSnapshot: snapshot.config.routeSnapshot,
      deploymentInputHash: deployment.snapshot.inputHash,
      workloadInputHash: workload.inputHash,
      providerKey: this.executor.providerKey,
    };
    const dns = await (input.refreshEvidence
      ? this.dns.collect(dnsInput)
      : this.dns.findFresh(dnsInput));
    const actionInput = {
      checkpoint: "pre_execution",
      environmentId: snapshot.environment.id,
      configRevisionId: snapshot.config.revisionId,
      manifestId: snapshot.manifest.id,
      buildRunId: snapshot.build.id,
      releaseRunId: null,
      providerKey: this.executor.providerKey,
      bindingId: deployment.snapshot.target.bindingId,
      deploymentInputHash: deployment.snapshot.inputHash,
      workloadInputHash: workload.inputHash,
      workloadServiceCount: String(workload.services.length),
      workloadHealthConfigured: String(workloadHealthConfigured),
      previewInputHash: input.preview.inputHash,
    };
    const gatePreview = await this.gates.preview({
      teamId: input.teamId,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      actorId: input.actorId,
      checkpoint: "production_pre_execution",
      target: {
        buildRunId: snapshot.build.id,
        manifestId: snapshot.manifest.id,
        environmentId: snapshot.environment.id,
        configRevisionId: snapshot.config.revisionId,
        providerKey: this.executor.providerKey,
        bindingId: deployment.snapshot.target.bindingId,
        deploymentInputHash: deployment.snapshot.inputHash,
        workloadInputHash: workload.inputHash,
        workloadServiceCount: workload.services.length,
        workloadHealthConfigured,
        releaseStrategy: snapshot.releasePolicy.strategy,
        requireProductionApproval:
          snapshot.releasePolicy.requireProductionApproval,
        previewInputHash: input.preview.inputHash,
        capacitySnapshotId: capacity?.id,
        capacitySnapshotHash: capacity?.measurementHash,
        dnsProbeReceiptId: dns?.id,
        dnsProbeResultHash: dns?.resultHash,
      },
      actionInput,
    });
    const required = new Set(releaseGateCheckpointPolicy(
      "production_pre_execution",
    ).requiredGateIds);
    return {
      ...gatePreview,
      checks: gatePreview.checks.filter((check) => required.has(check.id)).map((check) => ({
        ...check,
        repairHref: productionGateRepairHref({
          projectId: input.projectId, environmentId: snapshot.environment.id,
          gateId: check.id, serviceId: failingServiceId(workload, check.id),
          environmentKey: snapshot.environment.key,
        }),
        deferredUntilApproval: check.id === "D13",
        localOnly: localGateEvidence(check.reasonCode),
      })),
      acceptanceOnly: localAcceptance(this.executor.providerKey, dns),
      readiness: !gatePreview.decision.allowed
        ? "blocked"
        : localAcceptance(this.executor.providerKey, dns)
          ? "technical_acceptance"
          : "production_ready",
      repairHref: productionGateRepairHref({
        projectId: input.projectId, environmentId: snapshot.environment.id,
        gateId: gatePreview.decision.preApprovalBlockerGateIds[0],
        serviceId: failingServiceId(
          workload,
          gatePreview.decision.preApprovalBlockerGateIds[0],
        ),
        environmentKey: snapshot.environment.key,
      }),
      frozen: {
        deploymentInputHash: deployment.snapshot.inputHash,
        workloadInputHash: workload.inputHash,
        workloadServiceCount: workload.services.length,
        workloadHealthConfigured,
      },
      admissionProof: {
        preApprovalAllowed: gatePreview.decision.preApprovalAllowed,
        previewInputHash: input.preview.inputHash,
        deploymentInputHash: deployment.snapshot.inputHash,
        workloadInputHash: workload.inputHash,
        deploymentSnapshot: deployment.snapshot,
        capacitySnapshotId: capacity?.id,
        dnsProbeReceiptId: dns?.id,
        checks: gatePreview.checks.filter((check) => required.has(check.id)).map((check) => ({
          id: check.id, status: check.status, fresh: check.fresh,
          expiresAt: check.expiresAt, evidenceIdentity: check.evidenceIdentity,
        })),
      },
    };
  }
}

function failingServiceId(
  workload: { services: Array<{ serviceId: string; resources?: unknown;
    executionMode: string; statusCommand?: string; health?: unknown }> },
  gateId?: string,
) {
  if (gateId === "D05") {
    return workload.services.find((service) =>
      !service.resources)?.serviceId;
  }
  if (gateId === "D17") {
    return workload.services.find((service) =>
      service.executionMode === "managed-command-v1"
        ? !service.statusCommand
        : !service.health)?.serviceId;
  }
  return undefined;
}

function localGateEvidence(reasonCode: string) {
  return reasonCode.includes("local_acceptance") ||
    reasonCode.includes("local_resolver") ||
    reasonCode.includes("local_single_tenant");
}

function localAcceptance(providerKey: string, dns: { providerKey?: string } | null) {
  return providerKey === "local-filesystem-v1" ||
    dns?.providerKey === "local-filesystem-v1";
}
