import { createHash } from "node:crypto";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import type { ReleaseBuildArgvOutcome } from "./release-build-argv-command-runner";
import type { ReleaseBuildGateEvidence } from "./release-build-evidence.types";
import type { ReleaseEvidenceArtifactPort } from "./release-evidence-artifact.port";
import { sanitizeBuildLogs } from "./release-build-log.utils";

export async function publishReleaseBuildEvidence(input: {
  artifacts: ReleaseEvidenceArtifactPort;
  projectId: string;
  releaseOrderId: string;
  buildRunId: string;
  sourceCommitSha: string;
  sourceSnapshotDigest: string;
  profile: RegisteredReleaseBuildProfile;
  category: string;
  toolId: string;
  toolVersion: string;
  rulesDigest: string;
  dataDigest?: string;
  dataUpdatedAt?: string;
  outcome: ReleaseBuildArgvOutcome;
  result: unknown;
  passed: boolean;
  reasonCode: string;
}): Promise<ReleaseBuildGateEvidence> {
  const identityBase = {
    sourceCommitSha: input.sourceCommitSha,
    sourceSnapshotDigest: input.sourceSnapshotDigest,
    buildRunId: input.buildRunId,
    profileId: input.profile.id,
    profileVersion: input.profile.profileVersion,
    toolId: input.toolId,
    toolVersion: input.toolVersion,
    rulesDigest: input.rulesDigest,
    dataDigest: input.dataDigest ?? null,
    dataUpdatedAt: input.dataUpdatedAt ?? null,
    argvDigest: input.outcome.argvDigest,
    exitCode: input.outcome.exitCode,
    startedAt: input.outcome.startedAt,
    finishedAt: input.outcome.finishedAt,
  };
  const [stdout, stderr] = sanitizeBuildLogs([
    input.outcome.stdout,
    input.outcome.stderr,
  ]);
  const report = {
    version: 1,
    identity: identityBase,
    outcome: { ...input.outcome, stdout, stderr },
    result: input.result,
  };
  const artifact = await input.artifacts.publish({
    projectId: input.projectId,
    releaseOrderId: input.releaseOrderId,
    buildRunId: input.buildRunId,
    category: input.category,
    report,
  });
  const identity = { ...identityBase, reportDigest: artifact.reportDigest };
  return {
    status: input.passed ? "passed" : "failed",
    reasonCode: input.reasonCode,
    evidenceRef: artifact.evidenceRef,
    evidenceHash: createHash("sha256")
      .update(JSON.stringify(identity))
      .digest("hex"),
    identity,
  };
}

export function unavailableReleaseBuildEvidence(
  reasonCode: string,
): ReleaseBuildGateEvidence {
  return {
    status: "unavailable",
    reasonCode,
    evidenceRef: null,
    evidenceHash: null,
  };
}
