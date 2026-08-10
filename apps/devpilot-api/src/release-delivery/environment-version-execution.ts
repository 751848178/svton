import { NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import type { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import {
  type EnvironmentVersionProductionGateService,
  gateDecisionReference,
} from "./environment-version-production-gate.service";
import type { EnvironmentVersionRepository } from "./environment-version.repository";
import type { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import type { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import type { ReleaseStagingWorkloadService } from "./release-staging-workload.service";
import type { ReleaseStagingExecutorPort } from "./release-staging.types";
import type { SiteRouteSwitchPort } from "../site/site-route-switch.port";
import type { ProductionRouteSagaGuard } from "../site/production-route-saga.guard";
import { environmentVersionDeploymentParams } from "./environment-version-deployment-params";
import { freezeEnvironmentVersionInput } from "./environment-version-input-freeze";
import { verifiedEnvironmentVersionBundle } from "./environment-version-artifact.policy";
import { environmentVersionRequestHash } from "./environment-version-request-hash";
import { resolveEnvironmentVersionRecoveryInput } from "./environment-version-recovery-input";
import type {
  EnvironmentVersionExecuteInput,
  EnvironmentVersionExecutionContext,
} from "./environment-version-execution.types";

interface Dependencies {
  repository: EnvironmentVersionRepository;
  policy: EnvironmentVersionPolicyService;
  executor: ReleaseStagingExecutorPort;
  productionGates: EnvironmentVersionProductionGateService;
  inputs: ReleaseDeploymentInputService;
  stagingWorkloads: ReleaseStagingWorkloadService;
  productionWorkloads: ReleaseProductionWorkloadService;
  routeSwitch: SiteRouteSwitchPort;
  routeSagaGuard: ProductionRouteSagaGuard;
  run(
    context: EnvironmentVersionExecutionContext,
  ): ReturnType<EnvironmentVersionCompletionRepository["complete"]>;
}

export async function executeEnvironmentVersion(
  deps: Dependencies,
  requestedInput: EnvironmentVersionExecuteInput,
) {
  const input = {
    ...requestedInput,
    idempotencyKey: requestedInput.idempotencyKey ?? randomUUID(),
  };
  const environment = await deps.repository.environment(
    input.teamId,
    input.projectId,
    input.environmentId,
  );
  if (!environment) {
    throw new NotFoundException("目标环境不存在或不属于当前项目");
  }
  if (
    environment.baselineRole !== "staging" &&
    environment.baselineRole !== "production"
  ) {
    throw new NotFoundException("目标环境缺少可部署基线角色");
  }
  const requestHash = environmentVersionRequestHash(input);
  const replay = await deps.repository.replay({
    teamId: input.teamId,
    projectId: input.projectId,
    actorId: input.actorId,
    environmentId: input.environmentId,
    idempotencyKey: input.idempotencyKey,
    requestHash,
  });
  if (replay) {
    return { run: replay, version: replay.environmentVersion ?? null };
  }
  if (environment.baselineRole === "production") {
    await deps.routeSagaGuard.assertClear(input);
    await deps.routeSwitch.verifyProductionCapability();
  }
  const resolvedInput = await resolveEnvironmentVersionRecoveryInput(
    deps.repository,
    input,
    environment,
  );
  const selection = await deps.policy.resolveSelection(
    resolvedInput,
    environment.currentEnvironmentVersionId,
  );
  const manifest = await deps.repository.manifest(
    input.teamId,
    input.projectId,
    selection.manifestId,
  );
  if (!manifest) {
    throw new NotFoundException("Manifest 不存在或不属于当前项目");
  }
  const bundle = verifiedEnvironmentVersionBundle(manifest);
  const productionRun = await deps.policy.validateProduction(
    { ...input, kind: input.kind },
    environment,
    manifest,
  );
  const releaseRunId = productionRun?.id;
  const frozenConfigRevisionId =
    productionRun?.configRevisionId ?? environment.currentConfigRevisionId;
  const { frozenInput, actionInputHash } = await freezeEnvironmentVersionInput(
    deps,
    {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: environment.id,
      baselineRole: environment.baselineRole,
      providerKey: deps.executor.providerKey,
      configRevisionId: frozenConfigRevisionId,
      manifestId: manifest.id,
      kind: input.kind,
      sourceVersionId: selection.sourceVersionId,
      releaseRunId,
    },
  );
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
    providerKey: deps.executor.providerKey,
    bindingId: frozenInput.deploymentInput.snapshot.target.bindingId,
    deploymentInputHash: frozenInput.deploymentInput.snapshot.inputHash,
    idempotencyKey: input.idempotencyKey,
  };
  const admissionDecision = await deps.productionGates.admit(
    gateContext,
    environment.baselineRole,
  );
  const run = await deps.repository.reserve({
    teamId: input.teamId,
    projectId: input.projectId,
    actorId: input.actorId,
    environmentId: environment.id,
    configRevisionId: frozenConfigRevisionId,
    manifestId: manifest.id,
    releaseOrderId: manifest.releaseOrderId,
    releaseRunId,
    idempotencyKey: input.idempotencyKey,
    inputHash: actionInputHash,
    requestHash,
    mode: input.kind === "recovery" ? "rollback" : "deploy",
    branch: manifest.buildRun.sourceBranch,
    commitSha: manifest.buildRun.sourceCommitSha,
    params: environmentVersionDeploymentParams({
      providerKey: deps.executor.providerKey,
      input,
      selection,
      manifest,
      releaseRunId,
      frozenConfigRevisionId,
      frozenInput,
      productionRun,
      admissionDecision,
      actionInputHash,
    }),
    providerKey: deps.executor.providerKey,
    gateDecision: gateDecisionReference(admissionDecision),
  });
  if (run.idempotentReplay) {
    return { run, version: run.environmentVersion ?? null };
  }
  return deps.run({
    input,
    environment:
      environment as EnvironmentVersionExecutionContext["environment"],
    manifest,
    bundle,
    selection,
    productionRun,
    releaseRunId,
    frozenConfigRevisionId,
    actionInputHash,
    gateContext,
    frozenInput,
    run,
  });
}
