import { ConflictException } from "@nestjs/common";
import type { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import type { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import type { ReleaseStagingWorkloadService } from "./release-staging-workload.service";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

export async function freezeEnvironmentVersionInput(
  deps: {
    inputs: ReleaseDeploymentInputService;
    stagingWorkloads: ReleaseStagingWorkloadService;
    productionWorkloads: ReleaseProductionWorkloadService;
  },
  input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    baselineRole: "staging" | "production";
    providerKey: string;
    configRevisionId: string | null;
    manifestId: string;
    kind: string;
    sourceVersionId?: string;
    releaseRunId?: string;
  },
) {
  const deploymentInput = await deps.inputs.prepare({
    teamId: input.teamId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    providerKey: input.providerKey,
    configRevisionId: input.configRevisionId ?? undefined,
    label: input.baselineRole === "production" ? "Production" : "Staging",
  });
  const workloadScope = {
    teamId: input.teamId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    manifestId: input.manifestId,
  };
  const workload = input.baselineRole === "production"
    ? await deps.productionWorkloads.prepare(workloadScope)
    : await deps.stagingWorkloads.prepare(workloadScope);
  const workloadComponents = new Set(
    workload.services.map((service) => service.componentKey),
  );
  const unknownComponent = Object.keys(
    deploymentInput.componentEnvironments,
  ).find((componentKey) => !workloadComponents.has(componentKey));
  if (unknownComponent) {
    throw new ConflictException(
      `资源绑定组件 ${unknownComponent} 不属于冻结工作负载`,
    );
  }
  const actionInputHash = hashCanonicalReleaseValue({
    environmentId: input.environmentId,
    kind: input.kind,
    manifestId: input.manifestId,
    sourceVersionId: input.sourceVersionId ?? null,
    releaseRunId: input.releaseRunId ?? null,
    deploymentInputHash: deploymentInput.snapshot.inputHash,
    workloadInputHash: workload.inputHash,
  });
  return {
    actionInputHash,
    frozenInput: { deploymentInput, workload },
  };
}
