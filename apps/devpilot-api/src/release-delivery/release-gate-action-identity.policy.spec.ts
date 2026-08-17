import { releaseGateActionIdentity } from "./release-gate-action-identity.policy";

describe("release gate stable approval subject", () => {
  const base = {
    checkpoint: "production_promote_pre_route" as const,
    requesterActorId: "actor-1",
    actionInput: {
      releaseRunId: "release-1",
      deploymentRunId: "deployment-1",
      manifestId: "manifest-1",
      candidateHash: "a".repeat(64),
      promotionCommandId: "command-1",
    },
  };

  it("keeps the subject stable while binding each command attempt", () => {
    const first = releaseGateActionIdentity(base);
    const retry = releaseGateActionIdentity({
      ...base,
      actionInput: { ...base.actionInput, promotionCommandId: "command-2" },
    });
    expect(retry.approvalSubjectHash).toBe(first.approvalSubjectHash);
    expect(retry.actionInputHash).not.toBe(first.actionInputHash);
  });

  it("changes the subject when the exact candidate changes", () => {
    const first = releaseGateActionIdentity(base);
    const changed = releaseGateActionIdentity({
      ...base,
      actionInput: { ...base.actionInput, candidateHash: "b".repeat(64) },
    });
    expect(changed.approvalSubjectHash).not.toBe(first.approvalSubjectHash);
    expect(changed.actionInputHash).not.toBe(first.actionInputHash);
  });
});
