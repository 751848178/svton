import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { GateEvaluationRepository } from "./gate-evaluation.repository";
import { ReleaseGateDecisionRepository } from "./release-gate-decision.repository";
import type { ReleaseGateDecisionDraft } from "./release-gate-decision.types";

const describeIntegration =
  process.env.RUN_RELEASE_GATE_DECISION_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("ReleaseGateDecision integration", () => {
  const prisma = new PrismaClient();
  const db = prisma as unknown as PrismaService;
  const decisions = new ReleaseGateDecisionRepository(db);
  const evaluations = new GateEvaluationRepository(db);
  const suffix = randomUUID();
  const userId = `gate-user-${suffix}`;
  const otherUserId = `gate-other-user-${suffix}`;
  const teamId = `gate-team-${suffix}`;
  const projectId = `gate-project-${suffix}`;
  let orderId: string;
  const scope = () => ({
    teamId,
    actorId: userId,
    projectId,
    releaseOrderId: orderId,
  });

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@gate.example`, role: "user" },
    });
    await prisma.user.create({
      data: {
        id: otherUserId,
        email: `${suffix}-other@gate.example`,
        role: "user",
      },
    });
    await prisma.team.create({ data: { id: teamId, name: "Gate Team" } });
    await prisma.project.create({
      data: {
        id: projectId,
        teamId,
        createdById: userId,
        name: "Gate Project",
        config: {},
      },
    });
    orderId = (
      await prisma.releaseOrder.create({
        data: {
          teamId,
          projectId,
          createdById: userId,
          releaseVersion: "1.0.0",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.team.delete({ where: { id: teamId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: otherUserId } });
    await prisma.$disconnect();
  });

  it("reuses an exact request snapshot and rejects request-key drift", async () => {
    const first = await decisions.persist(scope(), draft(), "request-1");
    const replay = await decisions.persist(scope(), draft(), "request-1");
    expect(replay).toEqual(first);
    await expect(
      decisions.persist(
        scope(),
        draft({ sourceCommitSha: "b".repeat(40) }),
        "request-1",
      ),
    ).rejects.toMatchObject({ status: 409 });
    const changedOutcome = draft();
    changedOutcome.allowed = false;
    changedOutcome.blockerGateIds = ["C01"];
    await expect(
      decisions.persist(scope(), changedOutcome, "request-1"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("converges concurrent first inserts for one exact request key", async () => {
    const requestKey = `concurrent-${suffix}`;
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        decisions.persist(scope(), draft(), requestKey),
      ),
    );

    expect(new Set(results.map((result) => result.id))).toEqual(
      new Set([results[0].id]),
    );
    await expect(
      prisma.releaseGateDecision.count({
        where: { releaseOrderId: orderId, stage: "build", requestKey },
      }),
    ).resolves.toBe(1);
  });

  it("claims one exact allowed decision once and records its action", async () => {
    const decision = await decisions.persist(scope(), draft());
    await prisma.$transaction((tx) =>
      decisions.claim(tx, {
        ...scope(),
        decisionId: decision.id,
        stage: decision.stage,
        inputHash: decision.inputHash,
        actionRunType: "test_action",
        actionRunId: "action-1",
        requireAllowed: true,
      }),
    );
    await expect(
      prisma.releaseGateDecision.findUniqueOrThrow({
        where: { id: decision.id },
      }),
    ).resolves.toMatchObject({
      actionRunType: "test_action",
      actionRunId: "action-1",
      consumedAt: expect.any(Date),
    });
    await expect(
      prisma.$transaction((tx) =>
        decisions.claim(tx, {
          ...scope(),
          decisionId: decision.id,
          stage: decision.stage,
          inputHash: decision.inputHash,
          actionRunType: "test_action",
          actionRunId: "action-2",
          requireAllowed: true,
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects request-key replay and claim by another actor", async () => {
    const decision = await decisions.persist(scope(), draft(), "actor-bound");
    await expect(
      decisions.persist(
        { ...scope(), actorId: otherUserId },
        draft(),
        "actor-bound",
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      prisma.$transaction((tx) =>
        decisions.claim(tx, {
          ...scope(),
          actorId: otherUserId,
          decisionId: decision.id,
          stage: decision.stage,
          inputHash: decision.inputHash,
          actionRunType: "test_action",
          actionRunId: "actor-drift",
          requireAllowed: true,
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("binds manual confirmation to one real evaluation input", async () => {
    const inputHash = randomUUID();
    const evaluation = await prisma.gateEvaluation.create({
      data: {
        ...scope(),
        gateId: "C06",
        definitionVersion: "test",
        status: "needs_human",
        providerKey: "test.manual-provider",
        reasonCode: "manual_review_required",
        sourceSystem: "integration",
        inputHash,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const confirmed = await evaluations.confirmManual({
      ...scope(),
      evaluationId: evaluation.id,
      gateId: "C06",
      reason: "Reviewed exact evidence",
    });
    expect(confirmed).toMatchObject({
      waiver: expect.objectContaining({
        kind: "manual_confirmation",
        actorId: userId,
        evaluationInputHash: inputHash,
      }),
    });
  });
});

function draft(
  actionInput: Record<string, string | null> = {
    sourceCommitSha: "a".repeat(40),
  },
): ReleaseGateDecisionDraft {
  return {
    stage: "build",
    phase: "commit",
    allowed: true,
    blockerGateIds: [],
    manualGateIds: [],
    confirmedManualGateIds: [],
    warningGateIds: [],
    deferredGateIds: [],
    evidenceOnlyGateIds: [],
    integrityErrors: [],
    snapshot: {
      version: 1,
      stage: "build",
      phase: "commit",
      actionInput,
      evaluations: [],
    },
  };
}
