import type { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { gateDecisionReference } from "./environment-version-production-gate.service";
import type {
  EnvironmentVersionExecuteInput,
  EnvironmentVersionExecutionContext,
} from "./environment-version-execution.types";
import type { ReleaseStagingExecutorPort } from "./release-staging.types";

export function environmentVersionDeploymentParams(args: {
  executor: ReleaseStagingExecutorPort;
  input: EnvironmentVersionExecuteInput;
  selection: EnvironmentVersionExecutionContext["selection"];
  manifest: EnvironmentVersionExecutionContext["manifest"];
  releaseRunId: string | undefined;
  frozenConfigRevisionId: string | null;
  frozenInput: EnvironmentVersionExecutionContext["frozenInput"];
  productionRun: EnvironmentVersionExecutionContext["productionRun"];
  admissionDecision: Awaited<
    ReturnType<EnvironmentVersionProductionGateService["admit"]>
  >;
}): Record<string, unknown> {
  const targetRef =
    args.frozenInput?.deploymentInput.snapshot.target.targetRef ??
    args.executor.providerTargetRef;
  return {
    version: 1,
    environmentVersionKind: args.input.kind,
    sourceVersionId: args.selection.sourceVersionId,
    manifestId: args.manifest.id,
    manifestDigest: args.manifest.digest,
    releaseRunId: args.releaseRunId,
    configRevisionId: args.frozenConfigRevisionId,
    deploymentProvider: { key: args.executor.providerKey, targetRef },
    ...(args.frozenInput
      ? {
          deploymentInput: args.frozenInput.deploymentInput.snapshot,
          workload: args.frozenInput.workload,
          productionSnapshot: {
            resourceSnapshot: args.productionRun?.resourceSnapshot,
            routeSnapshot: args.productionRun?.routeSnapshot,
            policySnapshot: args.productionRun?.policySnapshot,
          },
        }
      : {}),
    gateDecision: gateDecisionReference(args.admissionDecision),
  };
}
