import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import type { ProductionPromotionResumeInput } from '../types/environment-version.types';
import { frozenProductionCandidate } from '../utils/production-promotion-candidate.model';

export function releaseProductionCurrentRun(
  runs: ReleaseEvidenceProductionRun[],
  focusedReleaseRunId: string | undefined,
  releaseOrderId: string,
) {
  const approvalRun =
    runs.find((run) => run.id === focusedReleaseRunId) || runs[0] || null;
  const succeeded = runs.find((run) => terminal(run.status));
  const active = Boolean(
    approvalRun &&
      (['awaiting_approval', 'approved', 'running', 'awaiting_validation'].includes(
        approvalRun.status,
      ) || approvalRun.operationApproval.status === 'pending'),
  );
  return {
    approvalRun,
    succeededOnline: Boolean(succeeded),
    currentOnline: succeeded?.verifiedDigest || '',
    pendingApprovals: runs.filter((run) => run.operationApproval.status === 'pending').length,
    active,
    needsRecovery: Boolean(
      approvalRun &&
        (approvalRun.status === 'failed' || approvalRun.operationApproval.status === 'rejected'),
    ),
    legacyRecovery: approvalRun?.legacyPromotionRecovery ?? null,
    awaitingResume: approvalRun?.legacyPromotionRecovery
      ? null : awaitingResume(approvalRun, releaseOrderId),
  };
}

function awaitingResume(
  run: ReleaseEvidenceProductionRun | null,
  releaseOrderId: string,
): { environmentId: string; input: ProductionPromotionResumeInput } | null {
  if (!run || run.status !== 'awaiting_validation') return null;
  const deployment = run.deploymentRuns.find(
    (item) =>
      item.status === 'awaiting_validation' &&
      item.environmentId === run.environmentId,
  );
  const candidate = frozenProductionCandidate(deployment?.result, {
    releaseOrderId,
    manifestId: run.artifactManifestId,
  });
  return deployment && candidate
    ? {
        environmentId: run.environmentId,
        input: {
          releaseRunId: run.id,
          deploymentRunId: deployment.id,
          candidateHash: candidate.candidateHash,
        },
      }
    : null;
}

function terminal(status: string) {
  return ['succeeded', 'completed'].includes(status.toLowerCase());
}
