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
      stage: "build",
      ...unresolvedDecisionInput(),
    });
    throw error;
  }
  const input = decisionInput(source);
  return {
    source,
    decision: await gates.assertAllowed({
      ...scope,
      stage: "build",
      ...input,
      // Provider-capability gates whose providers are not connected return
      // `unavailable` and are deferred with explicit reasons, mirroring the
      // production stage (environment-version-production-gate.service.ts
      // D06/D09/D17/D20/D14/D15, F437). The real evidence gates (C01 repo
      // resolvable, C05 component scope, C08 lockfile consistency) stay
      // genuinely checked and still fail closed on any other reason code.
      // See scripts/parity-switches.md (AC-E2E-005).
      deferredReasons: {
        C02: ["merge_state_provider_missing"],
        C03: ["required_checks_provider_missing"],
        C06: ["change_diff_provider_missing"],
        C07: ["secretScan_provider_missing", "security_build_missing"],
        C09: ["quality_evidence_missing", "build_missing"],
        C10: ["sast_provider_missing", "security_build_missing"],
      },
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
