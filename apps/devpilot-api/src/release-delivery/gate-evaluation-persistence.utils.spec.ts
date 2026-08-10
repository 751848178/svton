import type { ReleaseGateEvaluation } from "./release-gate-catalog.types";
import {
  buildGateEvaluationRow,
  persistedGateStatus,
} from "./gate-evaluation-persistence.utils";

const evaluation: ReleaseGateEvaluation = {
  id: "C01",
  phase: "commit",
  ordinal: 1,
  title: { zh: "提交", en: "Commit" },
  dispositions: [],
  capabilityId: "M01",
  delivery: "mvp",
  status: "checked",
  providerKey: "repository_connection",
  reasonCode: "commit_verified",
  reason: { zh: "已验证", en: "Verified" },
  evidenceRef: "build:1",
  checkedAt: "2026-08-03T10:00:00.000Z",
  expiresAt: "2026-08-04T10:00:00.000Z",
  fresh: true,
};

describe("GateEvaluation persistence mapping", () => {
  it("maps UI statuses to the canonical persisted contract", () => {
    expect([
      "checked", "unchecked", "blocked", "warning", "manual", "unavailable",
    ].map((status) => persistedGateStatus(status as never))).toEqual([
      "passed", "pending", "failed", "warning", "needs_human", "unavailable",
    ]);
  });

  it("produces a stable evidence-bound append identity", () => {
    const scope = {
      teamId: "team-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
      actorId: "user-1",
    };
    const first = buildGateEvaluationRow(scope, evaluation);
    const replay = buildGateEvaluationRow(scope, evaluation);
    const changed = buildGateEvaluationRow(scope, {
      ...evaluation,
      evidenceRef: "build:2",
    });
    expect(first).toMatchObject({
      gateId: "C01",
      status: "passed",
      sourceSystem: "repository_connection",
      buildRunId: "build-1",
    });
    expect(replay.inputHash).toBe(first.inputHash);
    expect(changed.inputHash).not.toBe(first.inputHash);
  });
});
