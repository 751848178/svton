import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import type { ReleaseGateCheckpoint } from "./release-gate-decision.types";

export type ReleaseGateActionIdentity = {
  approvalSubjectHash: string;
  actionInputHash: string;
  requesterActorId: string;
};

const SUBJECT_KEYS: Record<ReleaseGateCheckpoint, readonly string[]> = {
  build_pre_execution: ["repositoryIdentityRevisionId", "sourceBranch", "sourceCommitSha", "sourceResolution"],
  build_post_execution: ["buildRunId", "inputHash", "sourceCommitSha"],
  staging_pre_execution: ["buildRunId", "manifestId", "manifestDigest", "environmentId", "configRevisionId"],
  production_pre_execution: ["environmentId", "configRevisionId", "manifestId", "buildRunId", "releaseRunId", "providerKey", "bindingId", "deploymentInputHash", "workloadInputHash", "workloadServiceCount", "workloadHealthConfigured", "previewInputHash"],
  production_post_deploy: ["deploymentRunId", "environmentId", "configRevisionId", "buildRunId", "manifestId", "releaseRunId", "providerKey", "bindingId", "deploymentInputHash", "candidateHash"],
  production_promote: ["releaseRunId", "deploymentRunId", "manifestId", "candidateHash"],
  production_promote_pre_route: ["deploymentRunId", "releaseRunId", "manifestId", "deploymentInputHash", "candidateHash"],
  production_post_route: ["deploymentRunId", "releaseRunId", "candidateHash"],
};

export function releaseGateActionIdentity(input: {
  checkpoint: ReleaseGateCheckpoint;
  actionInput?: Record<string, string | null>;
  requesterActorId: string;
}): ReleaseGateActionIdentity {
  const actionInput = input.actionInput ?? {};
  return {
    approvalSubjectHash: stableHash({
      scope: "release-gate-approval-subject-v1",
      checkpoint: input.checkpoint,
      subject: Object.fromEntries(
        SUBJECT_KEYS[input.checkpoint].map((key) => [key, actionInput[key] ?? null]),
      ),
    }),
    actionInputHash: stableHash({
      scope: "release-gate-action-v1",
      checkpoint: input.checkpoint,
      actionInput,
    }),
    requesterActorId: input.requesterActorId,
  };
}
