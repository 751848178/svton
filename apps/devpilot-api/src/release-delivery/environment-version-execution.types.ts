import type { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import type { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import type { EnvironmentVersionRepository } from "./environment-version.repository";
import type { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import type { ReleaseProductionWorkloadService } from "./release-production-workload.service";

export interface EnvironmentVersionExecuteInput {
  teamId: string;
  actorId: string;
  projectId: string;
  environmentId: string;
  idempotencyKey?: string;
  kind: "upgrade" | "recovery";
  manifestId?: string;
  sourceVersionId?: string;
  releaseRunId?: string;
}

type Environment = NonNullable<
  Awaited<ReturnType<EnvironmentVersionRepository["environment"]>>
>;
type Manifest = NonNullable<
  Awaited<ReturnType<EnvironmentVersionRepository["manifest"]>>
>;
type Selection = Awaited<
  ReturnType<EnvironmentVersionPolicyService["resolveSelection"]>
>;
type ProductionRun = Awaited<
  ReturnType<EnvironmentVersionPolicyService["validateProduction"]>
>;
type DeploymentInput = Awaited<
  ReturnType<ReleaseDeploymentInputService["prepare"]>
>;
type Workload = Awaited<
  ReturnType<ReleaseProductionWorkloadService["prepare"]>
>;

export interface EnvironmentVersionExecutionContext {
  input: EnvironmentVersionExecuteInput;
  environment: Environment & { baselineRole: "staging" | "production" };
  manifest: Manifest;
  bundle: Manifest["items"][number];
  selection: Selection;
  productionRun: ProductionRun;
  releaseRunId: string | undefined;
  frozenConfigRevisionId: string | null;
  actionInputHash: string;
  gateContext: Parameters<EnvironmentVersionProductionGateService["admit"]>[0];
  frozenInput: { deploymentInput: DeploymentInput; workload: Workload };
  run: Awaited<ReturnType<EnvironmentVersionRepository["reserve"]>>;
}
