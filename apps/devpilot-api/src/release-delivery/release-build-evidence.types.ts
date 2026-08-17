import type { ReleaseBuildArgvOutcome } from "./release-build-argv-command-runner";

export type ReleaseBuildEvidenceIdentity = {
  sourceCommitSha: string;
  sourceSnapshotDigest: string;
  buildRunId: string;
  profileId: string;
  profileVersion: number;
  toolId: string;
  toolVersion: string;
  rulesDigest: string;
  dataDigest: string | null;
  dataUpdatedAt: string | null;
  argvDigest: string;
  exitCode: number;
  reportDigest: string;
  startedAt: string;
  finishedAt: string;
};

export type ReleaseBuildGateEvidence = {
  status: "passed" | "failed" | "unavailable";
  reasonCode: string;
  evidenceRef: string | null;
  evidenceHash: string | null;
  identity?: ReleaseBuildEvidenceIdentity;
};

export type ExecutedReleaseBuildReport = {
  version: 1;
  identity: Omit<ReleaseBuildEvidenceIdentity, "reportDigest">;
  outcome: ReleaseBuildArgvOutcome;
  result: unknown;
};
