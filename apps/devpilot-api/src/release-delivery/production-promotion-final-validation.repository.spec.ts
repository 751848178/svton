import { releaseGateActionIdentity } from "./release-gate-action-identity.policy";
import { releaseGateCheckpointPolicy } from "./release-gate-checkpoint.policy";
import { GATE_DEFINITION_VERSION } from "./gate-evaluation-persistence.utils";
import { freezeProductionPromotionCandidate } from "./production-promotion-candidate.policy";
import { assertProductionPromotionCurrent } from "./production-promotion-final-validation.repository";
import { promotionProbeHash } from "./production-promotion-observation.repository";

describe("Production promotion final transaction validation", () => {
  it("accepts exact lease, approval, gates, manual counts and P09 observation", async () => {
    const fixture = setup();
    await expect(assertProductionPromotionCurrent(
      fixture.tx as never,
      fixture.input as never,
    )).resolves.toBeUndefined();
    expect(fixture.tx.productionPromotionCommand.update).toHaveBeenCalledWith({
      where: { id: "command-1" },
      data: expect.objectContaining({ phase: "committing" }),
    });
  });

  it("rejects stale approval before committing any pointer", async () => {
    const fixture = setup();
    fixture.tx.operationApproval.findFirst.mockResolvedValue(null);
    await expect(assertProductionPromotionCurrent(
      fixture.tx as never,
      fixture.input as never,
    )).rejects.toMatchObject({ status: 409 });
    expect(fixture.tx.productionPromotionCommand.update).not.toHaveBeenCalled();
  });

  it("rejects expired manual evidence and a tampered P09 observation", async () => {
    const manual = setup();
    const preRow = manual.rows.find((row) => row.gateId === "P03" && row.id.startsWith("pre"))!;
    preRow.status = "needs_human";
    preRow.summary = { decisionIdentity: {
      actionInputHash: manual.input.preDecision.actionInputHash,
      requesterActorId: "actor-2",
    } };
    preRow.manualApprovals = [];
    await expect(assertProductionPromotionCurrent(
      manual.tx as never,
      manual.input as never,
    )).rejects.toMatchObject({ status: 409 });

    const observation = setup();
    observation.tx.siteRouteSwitchRun.findFirst.mockResolvedValue({
      promotionProbeHash: "tampered",
      promotionObservation: probe(),
    });
    await expect(assertProductionPromotionCurrent(
      observation.tx as never,
      observation.input as never,
    )).rejects.toMatchObject({ status: 409 });
  });
});

function setup() {
  const candidate = freezeProductionPromotionCandidate({
    version: 1, teamId: "team-1", projectId: "project-1",
    releaseOrderId: "order-1", environmentId: "environment-1",
    releaseRunId: "release-1", deploymentRunId: "deployment-1",
    configRevisionId: "config-1", manifestId: "manifest-1",
    manifestDigest: `sha256:${"a".repeat(64)}`, buildRunId: "build-1",
    providerKey: "ssh-v1", bindingId: "binding-1",
    deploymentInputHash: "b".repeat(64), workloadInputHash: "c".repeat(64),
    workloadServiceCount: 1, workloadHealthConfigured: true,
    targetRef: "server-1", kind: "upgrade",
  });
  const operationId = "site-route:deployment-1:site-1";
  const preAction = {
    checkpoint: "promote_pre_route", deploymentRunId: candidate.deploymentRunId,
    releaseRunId: candidate.releaseRunId, manifestId: candidate.manifestId,
    deploymentInputHash: candidate.deploymentInputHash,
    candidateHash: candidate.candidateHash, promotionCommandId: "command-1",
  };
  const postAction = {
    checkpoint: "post_route", deploymentRunId: candidate.deploymentRunId,
    releaseRunId: candidate.releaseRunId, candidateHash: candidate.candidateHash,
    promotionCommandId: "command-1", routeSwitchOperationId: operationId,
  };
  const preIdentity = releaseGateActionIdentity({
    checkpoint: "production_promote_pre_route", requesterActorId: "actor-2",
    actionInput: preAction,
  });
  const postIdentity = releaseGateActionIdentity({
    checkpoint: "production_post_route", requesterActorId: "actor-2",
    actionInput: postAction,
  });
  const preDecision = { id: "decision-pre", stage: "production",
    inputHash: "pre-input", actionInputHash: preIdentity.actionInputHash };
  const postDecision = { id: "decision-post", stage: "production",
    inputHash: "post-input", actionInputHash: postIdentity.actionInputHash };
  const snapshots = {
    "decision-pre": decisionSnapshot("production_promote_pre_route", preAction, preIdentity),
    "decision-post": decisionSnapshot("production_post_route", postAction, postIdentity),
  };
  const rows = Object.entries(snapshots).flatMap(([side, value]) =>
    value.inputSnapshot.evaluations.map((evaluation) => ({
      id: evaluation.evaluationId, gateId: evaluation.gateId,
      inputHash: evaluation.evaluationInputHash,
      definitionVersion: GATE_DEFINITION_VERSION,
      providerKey: "provider-v1", expiresAt: new Date("2099-08-11T00:00:00Z"),
      status: "passed", summary: {}, manualApprovals: [], side,
    })));
  const deployment = deploymentState(candidate);
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "locked" }]),
    productionPromotionCommand: {
      findFirst: jest.fn().mockResolvedValue({ id: "command-1" }),
      update: jest.fn().mockResolvedValue({ id: "command-1" }),
    },
    deploymentRun: { findFirst: jest.fn().mockResolvedValue(deployment) },
    operationApproval: { findFirst: jest.fn().mockResolvedValue({ expiresAt: null }) },
    releaseGateDecision: { findFirst: jest.fn(({ where }) =>
      Promise.resolve(snapshots[where.id as keyof typeof snapshots])) },
    gateEvaluation: { findMany: jest.fn(({ where }) => Promise.resolve(
      rows.filter((row) => where.id.in.includes(row.id)))) },
    siteRouteSwitchRun: { findFirst: jest.fn().mockResolvedValue({
      promotionProbeHash: promotionProbeHash(probe()),
      promotionObservation: probe(),
    }) },
  };
  return {
    tx, rows,
    input: {
      commandId: "command-1", actorId: "actor-2", candidate,
      lease: { owner: "owner-1", token: "token-1", tokenHash: "unused",
        expiresAt: new Date("2099-08-11T00:00:00Z") },
      routeSwitchOperationId: operationId, preDecision, postDecision,
    },
  };
}

function decisionSnapshot(checkpoint: "production_promote_pre_route" | "production_post_route",
  actionInput: Record<string, string>, identity: { actionInputHash: string }) {
  const gateIds = [...releaseGateCheckpointPolicy(checkpoint).requiredGateIds];
  return { inputSnapshot: { version: 3, checkpoint,
    requesterActorId: "actor-2", actionInputHash: identity.actionInputHash,
    actionInput, requiredGateIds: gateIds,
    evaluations: gateIds.map((gateId) => ({ gateId,
      evaluationId: `${checkpoint === "production_post_route" ? "post" : "pre"}-${gateId}`,
      evaluationInputHash: `${checkpoint}-${gateId}` })) } };
}

function deploymentState(candidate: ReturnType<typeof freezeProductionPromotionCandidate>) {
  return { result: { productionCandidate: candidate }, logs: [],
    artifactManifestId: candidate.manifestId, adapterKey: candidate.providerKey,
    projectEnvironment: { status: "active", baselineRole: "production",
      currentConfigRevisionId: candidate.configRevisionId },
    artifactManifest: { id: candidate.manifestId, digest: candidate.manifestDigest,
      buildRunId: candidate.buildRunId, releaseOrderId: candidate.releaseOrderId },
    releaseRun: { id: candidate.releaseRunId, status: "awaiting_validation",
      artifactManifestId: candidate.manifestId, verifiedDigest: candidate.manifestDigest,
      configRevisionId: candidate.configRevisionId, inputHash: "release-input",
      routeSnapshot: {}, operationApprovalId: "approval-1" } };
}

function probe() {
  const checkedAt = "2026-08-11T00:00:00.000Z";
  return { version: 1 as const, primaryDomain: "app.example.com",
    finalUrl: "https://app.example.com/", probedAt: checkedAt,
    dns: { status: "resolved" as const, checkedAt },
    tls: { status: "valid" as const, checkedAt },
    http: { status: "passed" as const, statusCode: 200,
      url: "https://app.example.com/", finalUrl: "https://app.example.com/", checkedAt } };
}
