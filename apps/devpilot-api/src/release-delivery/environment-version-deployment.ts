import { sanitizeBuildLogs } from "./release-build-log.utils";
import type { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import type { ReleaseStagingExecutorPort } from "./release-staging.types";
import type { EnvironmentVersionExecutionContext } from "./environment-version-execution.types";
import {
  completeFailedEnvironment,
  finalizeDeployedEnvironment,
  type EnvironmentVersionFinalizationDependencies,
} from "./environment-version-production-finalization";
import { localAcceptanceObservabilityEvidence } from "./release-local-observability-evidence";
import { localAcceptancePromotionEvidence } from "./release-local-promotion-evidence";

interface Dependencies extends EnvironmentVersionFinalizationDependencies {
  executor: ReleaseStagingExecutorPort;
  gateEvidence: EnvironmentVersionGateEvidenceRepository;
}

export async function runEnvironmentDeployment(
  deps: Dependencies,
  context: EnvironmentVersionExecutionContext,
) {
  try {
    const result = await deps.executor.deploy({
      deploymentRunId: context.run.id,
      stage: context.environment.baselineRole,
      projectId: context.input.projectId,
      releaseOrderId: context.manifest.releaseOrderId,
      environmentId: context.environment.id,
      manifestId: context.manifest.id,
      buildRunId: context.manifest.buildRun.id,
      uri: context.bundle.uri,
      digest: context.manifest.digest,
      deploymentInput: context.frozenInput.deploymentInput.snapshot,
      globalEnvironment: context.frozenInput.deploymentInput.globalEnvironment,
      componentEnvironments:
        context.frozenInput.deploymentInput.componentEnvironments,
      targetConnection: context.frozenInput.deploymentInput.targetConnection,
      workload: context.frozenInput.workload,
    });
    const logs = sanitizeBuildLogs(result.logs);
    const providerEvidence = { ...result.evidence };
    const observability = deps.executor.providerKey === "local-filesystem-v1"
      ? localAcceptanceObservabilityEvidence({
      providerKey: deps.executor.providerKey,
      configSnapshotHash:
        context.frozenInput.deploymentInput.snapshot.configRevision.snapshotHash,
      deploymentInputHash:
        context.frozenInput.deploymentInput.snapshot.inputHash,
      workloadInputHash: context.frozenInput.workload.inputHash,
      snapshot:
        context.frozenInput.deploymentInput.snapshot.observabilitySnapshot,
      evidence: providerEvidence,
      logs,
      })
      : undefined;
    const runtimeEvidence = {
      ...providerEvidence,
      ...(observability ? { observability } : {}),
      deploymentUri: result.deploymentUri,
      manifestId: context.manifest.id,
      manifestDigest: context.manifest.digest,
      sourceVersionId: context.selection.sourceVersionId,
    };
    const promotion = context.environment.baselineRole === "production"
      ? localAcceptancePromotionEvidence({
          providerKey: deps.executor.providerKey,
          observedAt: new Date(),
          manifest: context.manifest,
          deploymentInputHash:
            context.frozenInput.deploymentInput.snapshot.inputHash,
          workloadInputHash: context.frozenInput.workload.inputHash,
          evidence: runtimeEvidence,
        })
      : undefined;
    const evidence = { ...runtimeEvidence, ...(promotion ?? {}) };
    await deps.gateEvidence.record({
      deploymentRunId: context.run.id,
      logs,
      result: evidence,
    });
    if (context.environment.baselineRole !== "production") {
      return deps.completion.complete({
        deploymentRunId: context.run.id,
        kind: context.input.kind,
        teamId: context.input.teamId,
        actorId: context.input.actorId,
        projectId: context.input.projectId,
        releaseOrderId: context.manifest.releaseOrderId,
        status: "completed",
        logs,
        result: evidence,
      });
    }
    return finalizeDeployedEnvironment(deps, context, logs, evidence);
  } catch (error) {
    return completeFailedEnvironment(deps, context, error);
  }
}
