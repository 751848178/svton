import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";

export function evidenceBuild(context: ReleaseGateEvidenceContext) {
  const build = context.buildRuns[0];
  const targetCommit = context.decisionTarget?.sourceCommitSha;
  return targetCommit && build?.sourceCommitSha !== targetCommit
    ? undefined
    : build;
}
