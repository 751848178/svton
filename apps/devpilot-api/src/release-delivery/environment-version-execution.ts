import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
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
import { environmentVersionDeploymentParams } from "./environment-version-deployment-params";
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
  run(
    context: EnvironmentVersionExecutionContext,
  ): ReturnType<EnvironmentVersionCompletionRepository["complete"]>;
}

export async function executeEnvironmentVersion(
  deps: Dependencies,
  input: EnvironmentVersionExecuteInput,
) {
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
  const resolvedInput = await resolveRecoveryInput(
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
  const productionRun = await deps.policy.validateProduction(
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
  const admissionDecision = await deps.productionGates.admit(
    gateContext,
    environment.baselineRole,
  );
  const deploymentInput = await deps.inputs.prepare({
    teamId: input.teamId,
    projectId: input.projectId,
    environmentId: environment.id,
    providerKey: deps.executor.providerKey,
    configRevisionId: frozenConfigRevisionId ?? undefined,
    label: environment.baselineRole === "production" ? "Production" : "Staging",
  });
  const workloadScope = {
    teamId: input.teamId,
    projectId: input.projectId,
    environmentId: environment.id,
    manifestId: manifest.id,
  };
  const frozenInput = {
    deploymentInput,
    workload:
      environment.baselineRole === "production"
        ? await deps.productionWorkloads.prepare(workloadScope)
        : await deps.stagingWorkloads.prepare(workloadScope),
  };
  const run = await deps.repository.reserve({
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
    }),
    providerKey: deps.executor.providerKey,
    gateDecision: gateDecisionReference(admissionDecision),
  });
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
    gateContext,
    frozenInput,
    run,
  });
}

async function resolveRecoveryInput(
  repository: EnvironmentVersionRepository,
  input: EnvironmentVersionExecuteInput,
  environment: { id: string; baselineRole: string | null },
) {
  if (
    input.kind !== "recovery" ||
    environment.baselineRole !== "production" ||
    input.sourceVersionId
  ) {
    return input;
  }
  if (!input.releaseRunId) {
    throw new UnprocessableEntityException(
      "Production 回退必须绑定已批准的 Recovery ReleaseRun",
    );
  }
  const sourceVersionId = await repository.recoverySourceVersionId(
    input.teamId,
    input.projectId,
    environment.id,
    input.releaseRunId,
  );
  if (!sourceVersionId) {
    throw new UnprocessableEntityException(
      "Production 回退 ReleaseRun 未指向可用的历史环境版本",
    );
  }
  return { ...input, sourceVersionId };
}
