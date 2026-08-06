import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { ReleaseStagingExecutorPort } from "./release-staging.types";
import {
  EnvironmentVersionProductionGateService,
  gateDecisionReference,
} from "./environment-version-production-gate.service";
import { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import { environmentDeploymentFailureDetail } from "./environment-version-failure.utils";
import { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import {
  SiteRouteActivationPort,
  SiteProbePort,
  SiteRouteSwitchEvidence,
} from "../site/site-route-activation.types";
import {
  assertSiteProbeAcceptable,
  extractSiteEvidence,
} from "../site/site-probe-policy";

@Injectable()
export class EnvironmentVersionService {
  constructor(
    private readonly repository: EnvironmentVersionRepository,
    private readonly readRepository: EnvironmentVersionReadRepository,
    private readonly policy: EnvironmentVersionPolicyService,
    private readonly executor: ReleaseStagingExecutorPort,
    private readonly productionGates: EnvironmentVersionProductionGateService,
    private readonly gateEvidence: EnvironmentVersionGateEvidenceRepository,
    private readonly inputs: ReleaseDeploymentInputService,
    private readonly workloads: ReleaseProductionWorkloadService,
    private readonly routeActivation: SiteRouteActivationPort,
    private readonly siteProbe: SiteProbePort,
  ) {}

  async list(teamId: string, projectId: string) {
    const [environments, candidates] = await Promise.all([
      this.readRepository.environments(teamId, projectId),
      this.readRepository.candidates(teamId, projectId),
    ]);
    return { environments, candidates };
  }

  async execute(input: {
    teamId: string;
    actorId: string;
    projectId: string;
    environmentId: string;
    kind: "upgrade" | "recovery";
    manifestId?: string;
    sourceVersionId?: string;
    releaseRunId?: string;
  }) {
    const environment = await this.repository.environment(
      input.teamId,
      input.projectId,
      input.environmentId,
    );
    if (!environment)
      throw new NotFoundException("目标环境不存在或不属于当前项目");
    if (
      environment.baselineRole !== "staging" &&
      environment.baselineRole !== "production"
    ) {
      throw new NotFoundException("目标环境缺少可部署基线角色");
    }
    let resolvedInput = input;
    if (
      input.kind === "recovery" &&
      environment.baselineRole === "production" &&
      !input.sourceVersionId
    ) {
      if (!input.releaseRunId) {
        throw new UnprocessableEntityException(
          "Production 回退必须绑定已批准的 Recovery ReleaseRun",
        );
      }
      const derived = await this.repository.recoverySourceVersionId(
        input.teamId,
        input.projectId,
        environment.id,
        input.releaseRunId,
      );
      if (!derived) {
        throw new UnprocessableEntityException(
          "Production 回退 ReleaseRun 未指向可用的历史环境版本",
        );
      }
      resolvedInput = { ...input, sourceVersionId: derived };
    }
    const selection = await this.policy.resolveSelection(
      resolvedInput,
      environment.currentEnvironmentVersionId,
    );
    const manifest = await this.repository.manifest(
      input.teamId,
      input.projectId,
      selection.manifestId,
    );
    if (!manifest)
      throw new NotFoundException("Manifest 不存在或不属于当前项目");
    const bundle = manifest.items.find(
      (item) => item.componentKey === "project-bundle",
    );
    if (
      manifest.buildRun.status !== "succeeded" ||
      !bundle ||
      bundle.digest !== manifest.digest
    ) {
      throw new UnprocessableEntityException(
        "只能部署成功且 Digest 可验证的项目制品",
      );
    }
    const productionRun = await this.policy.validateProduction(
      { ...input, kind: input.kind },
      environment,
      manifest,
    );
    const releaseRunId = productionRun?.id;
    const frozenConfigRevisionId =
      productionRun?.configRevisionId ?? environment.currentConfigRevisionId;
    const gateContext = {
      teamId: input.teamId,
      actorId: input.actorId,
      projectId: input.projectId,
      releaseOrderId: manifest.releaseOrderId,
      environmentId: environment.id,
      configRevisionId: frozenConfigRevisionId,
      manifestId: manifest.id,
      buildRunId: manifest.buildRun.id,
      releaseRunId,
    };
    const admissionDecision = await this.productionGates.admit(gateContext);
    const frozenInput = releaseRunId
      ? {
          deploymentInput: await this.inputs.prepare({
            teamId: input.teamId,
            projectId: input.projectId,
            environmentId: environment.id,
            providerKey: this.executor.providerKey,
            configRevisionId: frozenConfigRevisionId ?? undefined,
            label: "Production",
          }),
          workload: await this.workloads.prepare({
            teamId: input.teamId,
            projectId: input.projectId,
            environmentId: environment.id,
            manifestId: manifest.id,
          }),
        }
      : undefined;
    const run = await this.repository.reserve({
      teamId: input.teamId,
      projectId: input.projectId,
      actorId: input.actorId,
      environmentId: environment.id,
      configRevisionId: frozenConfigRevisionId,
      manifestId: manifest.id,
      releaseOrderId: manifest.releaseOrderId,
      releaseRunId,
      mode: input.kind === "recovery" ? "rollback" : "deploy",
      branch: manifest.buildRun.sourceBranch,
      commitSha: manifest.buildRun.sourceCommitSha,
      params: {
        version: 1,
        environmentVersionKind: input.kind,
        sourceVersionId: selection.sourceVersionId,
        manifestId: manifest.id,
        manifestDigest: manifest.digest,
        releaseRunId,
        configRevisionId: frozenConfigRevisionId,
        deploymentProvider: {
          key: this.executor.providerKey,
          targetRef:
            frozenInput?.deploymentInput.snapshot.target.targetRef ??
            this.executor.providerTargetRef,
        },
        ...(frozenInput
          ? {
              deploymentInput: frozenInput.deploymentInput.snapshot,
              workload: frozenInput.workload,
              productionSnapshot: {
                resourceSnapshot: productionRun?.resourceSnapshot,
                routeSnapshot: productionRun?.routeSnapshot,
                policySnapshot: productionRun?.policySnapshot,
              },
            }
          : {}),
        gateDecision: gateDecisionReference(admissionDecision),
      },
      providerKey: this.executor.providerKey,
      gateDecision: gateDecisionReference(admissionDecision),
    });
    try {
      const result = await this.executor.deploy({
        deploymentRunId: run.id,
        stage: environment.baselineRole,
        projectId: input.projectId,
        releaseOrderId: manifest.releaseOrderId,
        environmentId: environment.id,
        manifestId: manifest.id,
        buildRunId: manifest.buildRun.id,
        uri: bundle.uri,
        digest: manifest.digest,
        ...(frozenInput
          ? {
              deploymentInput: frozenInput.deploymentInput.snapshot,
              runtimeEnvironment:
                frozenInput.deploymentInput.runtimeEnvironment,
              targetConnection: frozenInput.deploymentInput.targetConnection,
              workload: frozenInput.workload,
            }
          : {}),
      });
      const logs = sanitizeBuildLogs(result.logs);
      const evidence = {
        ...result.evidence,
        deploymentUri: result.deploymentUri,
        manifestId: manifest.id,
        manifestDigest: manifest.digest,
        sourceVersionId: selection.sourceVersionId,
      };
      await this.gateEvidence.record({
        deploymentRunId: run.id,
        logs,
        result: evidence,
      });
      const targetRef =
        frozenInput?.deploymentInput.snapshot.target.targetRef ??
        this.executor.providerTargetRef;
      const routeSnapshot =
        productionRun?.routeSnapshot &&
        typeof productionRun.routeSnapshot === "object" &&
        !Array.isArray(productionRun.routeSnapshot)
          ? (productionRun.routeSnapshot as Record<string, unknown>)
          : undefined;
      const activation = await this.routeActivation.resolve({
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: environment.id,
        routeSnapshot: routeSnapshot ?? null,
      });
      const probe = await this.siteProbe.probe({
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: environment.id,
        deploymentRunId: run.id,
        primaryDomain: activation.primaryDomain,
        tlsRequired: booleanValue(routeSnapshot?.tlsRequired),
        proxyTarget: activation.proxyTarget,
        targetRef,
      });
      const switchedAt = new Date().toISOString();
      const routeSwitch: SiteRouteSwitchEvidence = {
        version: 1,
        siteId: activation.siteId,
        primaryDomain: activation.primaryDomain,
        deploymentRunId: run.id,
        releaseRunId: releaseRunId ?? null,
        targetRef,
        proxyTarget: activation.proxyTarget,
        domains: activation.domains,
        status: activation.status === "matched" ? "switched" : "unavailable",
        reasonCode:
          activation.status === "matched"
            ? "site_switched"
            : activation.reasonCode,
        switchedAt: activation.status === "matched" ? switchedAt : null,
      };
      assertSiteProbeAcceptable(
        probe,
        routeSwitch as unknown as Record<string, unknown>,
      );
      const finalDecision = await this.productionGates.finalize({
        ...gateContext,
        deploymentRunId: run.id,
      });
      return this.repository.complete({
        deploymentRunId: run.id,
        status: "completed",
        kind: input.kind,
        logs,
        result: {
          ...evidence,
          siteProbe: probe,
          routeSwitch,
          gateDecision: gateDecisionReference(finalDecision),
        },
        teamId: input.teamId,
        actorId: input.actorId,
        projectId: input.projectId,
        releaseOrderId: manifest.releaseOrderId,
        gateDecision: gateDecisionReference(finalDecision),
        siteRouteSwitch: activation.siteId
          ? {
              teamId: input.teamId,
              projectId: input.projectId,
              environmentId: environment.id,
              siteId: activation.siteId,
              deploymentRunId: run.id,
              releaseRunId: releaseRunId ?? null,
              targetRef,
              proxyTarget: activation.proxyTarget,
              domains: activation.domains,
              result: { siteProbe: probe, routeSwitch },
              dnsProbe: probe.dns,
              tlsProbe: probe.tls,
            }
          : undefined,
      });
    } catch (error) {
      const detail = environmentDeploymentFailureDetail(error);
      const denied = await this.productionGates.denied(error, {
        ...gateContext,
        deploymentRunId: run.id,
      });
      return this.repository.complete({
        deploymentRunId: run.id,
        status: "failed",
        kind: input.kind,
        logs: detail.logs,
        error: `${detail.code}: ${detail.message}`,
        result: {
          manifestId: manifest.id,
          manifestDigest: manifest.digest,
          ...extractSiteEvidence(error),
          gateDecision: gateDecisionReference(denied),
        },
        teamId: input.teamId,
        actorId: input.actorId,
        projectId: input.projectId,
        releaseOrderId: manifest.releaseOrderId,
        gateDecision: gateDecisionReference(denied),
      });
    }
  }
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
