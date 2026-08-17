import type { ReleaseBuildSourceResolverService } from "./release-build-source-resolver.service";
import type { ReleaseBuildResolvedSource } from "./release-build.types";
import type { ReleaseGateDecisionService } from "./release-gate-decision.service";
import type {
  ReleaseGateDecision,
  ReleaseGateDecisionInput,
} from "./release-gate-decision.types";

type BuildGateScope = {
  teamId: string;
  actorId: string;
  projectId: string;
  releaseOrderId: string;
};

export async function previewReleaseBuildGate(
  sources: ReleaseBuildSourceResolverService,
  scope: BuildGateScope,
): Promise<ReleaseGateDecisionInput> {
  try {
    return decisionInput(
      await sources.resolve(
        scope.teamId,
        scope.projectId,
        scope.releaseOrderId,
      ),
    );
  } catch {
    return unresolvedDecisionInput();
  }
}

export async function admitReleaseBuild(
  sources: ReleaseBuildSourceResolverService,
  gates: ReleaseGateDecisionService,
  scope: BuildGateScope,
  signal?: AbortSignal,
): Promise<{
  source: ReleaseBuildResolvedSource;
  decision: ReleaseGateDecision;
}> {
  let source: ReleaseBuildResolvedSource;
  try {
    source = await sources.resolve(
      scope.teamId,
      scope.projectId,
      scope.releaseOrderId,
      signal,
    );
  } catch (error) {
    await gates.assertAllowed({
      ...scope,
      checkpoint: "build_pre_execution",
      ...unresolvedDecisionInput(),
    });
    throw error;
  }
  const input = decisionInput(source);
  return {
    source,
    decision: await gates.assertAllowed({
      ...scope,
      checkpoint: "build_pre_execution",
      ...input,
    }),
  };
}

function decisionInput(
  source: ReleaseBuildResolvedSource,
): ReleaseGateDecisionInput {
  return {
    target: {
      sourceBranch: source.identity.branch,
      sourceCommitSha: source.commitSha,
      sourceEvidence: source.sourceEvidence,
    },
    actionInput: {
      repositoryIdentityRevisionId: source.identity.revisionId,
      sourceBranch: source.identity.branch,
      sourceCommitSha: source.commitSha,
    },
  };
}

function unresolvedDecisionInput(): ReleaseGateDecisionInput {
  return {
    target: { sourceResolution: "unavailable" },
    actionInput: { sourceResolution: "unavailable" },
  };
}
