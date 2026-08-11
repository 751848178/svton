import {
  ReleaseGateBlockedException,
  ReleaseGateDecisionService,
} from "./release-gate-decision.service";

describe("ReleaseGateDecisionService", () => {
  const scope = {
    teamId: "team-1",
    actorId: "user-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
  };
  const evaluator = {
    evaluate: jest.fn().mockResolvedValue({ checks: [] }),
  };
  const decisions = { persist: jest.fn() };
  const service = new ReleaseGateDecisionService(
    evaluator as never,
    decisions as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("persists an auditable denied decision before rejecting the action", async () => {
    const denied = decision(false);
    decisions.persist.mockResolvedValue(denied);

    await expect(
      service.assertAllowed({ ...scope, checkpoint: "build_pre_execution" }),
    ).rejects.toEqual(
      expect.objectContaining({
        decision: denied,
        response: expect.objectContaining({ code: "RELEASE_GATE_BLOCKED" }),
      }),
    );
    expect(decisions.persist).toHaveBeenCalledTimes(1);
    expect(decisions.persist.mock.calls[0][1]).toMatchObject({
      stage: "build",
      allowed: false,
      integrityErrors: expect.arrayContaining(["C01:missing"]),
    });
  });

  it("returns only the persisted server decision when the action is allowed", async () => {
    const allowed = decision(true);
    decisions.persist.mockResolvedValue(allowed);
    await expect(
      service.assertAllowed({ ...scope, checkpoint: "build_pre_execution" }),
    ).resolves.toBe(allowed);
  });

  it("derives build_pre action hash and requester on the server", async () => {
    const allowed = decision(true);
    decisions.persist.mockResolvedValue(allowed);
    await service.assertAllowed({
      ...scope,
      checkpoint: "build_pre_execution",
      actionInput: { sourceCommitSha: "a".repeat(40) },
    });
    const identity = evaluator.evaluate.mock.calls[0][3];
    expect(identity).toEqual({
      actionInputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      requesterActorId: scope.actorId,
    });
    expect(decisions.persist.mock.calls[0][1]).toMatchObject({
      actionInputHash: identity.actionInputHash,
      requesterActorId: scope.actorId,
      snapshot: {
        version: 3,
        actionInputHash: identity.actionInputHash,
        requesterActorId: scope.actorId,
      },
    });
  });

  it("exposes the blocked decision through the stable exception contract", () => {
    const denied = decision(false);
    expect(new ReleaseGateBlockedException(denied).getResponse()).toMatchObject(
      {
        code: "RELEASE_GATE_BLOCKED",
        publicData: { decision: denied },
      },
    );
  });
});

function decision(allowed: boolean) {
  return {
    id: `decision-${allowed}`,
    stage: "build" as const,
    checkpoint: "build_pre_execution" as const,
    phase: "commit" as const,
    actionInputHash: "action-hash",
    requesterActorId: "user-1",
    allowed,
    blockerGateIds: allowed ? [] : ["C01"],
    manualGateIds: [],
    confirmedManualGateIds: [],
    warningGateIds: [],
    deferredGateIds: [],
    evidenceOnlyGateIds: [],
    integrityErrors: [],
    inputHash: "input-hash",
    decidedAt: new Date(0).toISOString(),
  };
}
