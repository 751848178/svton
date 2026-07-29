import {
  isLegalPlanTransition,
  isLegalStageTransition,
  isStageTerminal,
  isPlanTerminal,
  derivePlanStatusFromStages,
} from "./release-state-machine.utils";

describe("release state machine plan transitions", () => {
  it("allows legal transitions", () => {
    expect(isLegalPlanTransition("draft", "ready")).toBe(true);
    expect(isLegalPlanTransition("ready", "running")).toBe(true);
    expect(isLegalPlanTransition("running", "succeeded")).toBe(true);
    expect(isLegalPlanTransition("running", "failed")).toBe(true);
    expect(isLegalPlanTransition("running", "blocked")).toBe(true);
    expect(isLegalPlanTransition("blocked", "running")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(isLegalPlanTransition("succeeded", "running")).toBe(false);
    expect(isLegalPlanTransition("failed", "succeeded")).toBe(false);
    expect(isLegalPlanTransition("canceled", "ready")).toBe(false);
    expect(isLegalPlanTransition("draft", "succeeded")).toBe(false);
  });

  it("same status is allowed", () => {
    expect(isLegalPlanTransition("ready", "ready")).toBe(true);
  });

  // F383 D1: 失败计划经 retryStage 事务内受控回到 running，failed 不再是终态。
  it("failed -> running is legal (controlled retry)", () => {
    expect(isLegalPlanTransition("failed", "running")).toBe(true);
    // failed 不再回到 ready/awaiting_approval/draft
    expect(isLegalPlanTransition("failed", "ready")).toBe(false);
    expect(isLegalPlanTransition("failed", "succeeded")).toBe(false);
  });

  it("terminal statuses are terminal", () => {
    expect(isPlanTerminal("succeeded")).toBe(true);
    expect(isPlanTerminal("failed")).toBe(false); // failed 不再是终态（D1）
    expect(isPlanTerminal("canceled")).toBe(true);
    expect(isPlanTerminal("running")).toBe(false);
  });
});

describe("release state machine stage transitions", () => {
  it("allows normal flow", () => {
    expect(isLegalStageTransition("pending", "ready")).toBe(true);
    expect(isLegalStageTransition("ready", "queued")).toBe(true);
    expect(isLegalStageTransition("queued", "running")).toBe(true);
    expect(isLegalStageTransition("running", "succeeded")).toBe(true);
    expect(isLegalStageTransition("running", "failed")).toBe(true);
  });

  it("failed -> ready only via explicit retry", () => {
    expect(isLegalStageTransition("failed", "ready")).toBe(true);
    // 失败不能直接成成功
    expect(isLegalStageTransition("failed", "succeeded")).toBe(false);
  });

  it("terminal not overwritable", () => {
    expect(isLegalStageTransition("succeeded", "failed")).toBe(false);
    expect(isLegalStageTransition("skipped", "succeeded")).toBe(false);
    expect(isLegalStageTransition("canceled", "ready")).toBe(false);
  });

  it("optional skip path", () => {
    expect(isLegalStageTransition("pending", "skipped")).toBe(true);
    expect(isLegalStageTransition("blocked", "skipped")).toBe(true);
  });

  // F383 Slice 1: 新增的状态转换。对应 invest-1 §B.2 修复项。
  it("pending/blocked -> queued legal (coordinator CAS bypasses ready)", () => {
    expect(isLegalStageTransition("pending", "queued")).toBe(true);
    expect(isLegalStageTransition("blocked", "queued")).toBe(true);
  });

  it("queued -> skipped legal (manual skip of queued-not-started optional)", () => {
    expect(isLegalStageTransition("queued", "skipped")).toBe(true);
  });

  it("running -> skipped legal (health auto-skip when 0 candidates)", () => {
    expect(isLegalStageTransition("running", "skipped")).toBe(true);
  });

  it("failed -> queued legal (retry can directly re-queue)", () => {
    expect(isLegalStageTransition("failed", "queued")).toBe(true);
    expect(isLegalStageTransition("failed", "ready")).toBe(true);
    expect(isLegalStageTransition("failed", "running")).toBe(false);
  });

  it("isStageTerminal", () => {
    expect(isStageTerminal("succeeded")).toBe(true);
    expect(isStageTerminal("skipped")).toBe(true);
    expect(isStageTerminal("canceled")).toBe(true);
    expect(isStageTerminal("running")).toBe(false);
    expect(isStageTerminal("failed")).toBe(false); // 仍可 retry
    expect(isStageTerminal("queued")).toBe(false);
  });
});

describe("derivePlanStatusFromStages", () => {
  it("all succeeded -> succeeded", () => {
    expect(
      derivePlanStatusFromStages(["succeeded", "succeeded", "skipped"]),
    ).toEqual({ status: "succeeded" });
  });

  it("any failed -> failed", () => {
    const r = derivePlanStatusFromStages(["succeeded", "failed"]);
    expect(r.status).toBe("failed");
  });

  it("any canceled -> canceled", () => {
    expect(derivePlanStatusFromStages(["canceled", "succeeded"]).status).toBe(
      "canceled",
    );
  });

  it("blocked and not running -> blocked", () => {
    const r = derivePlanStatusFromStages(["succeeded", "blocked"]);
    expect(r.status).toBe("blocked");
  });

  it("running present -> running", () => {
    expect(
      derivePlanStatusFromStages(["succeeded", "running", "blocked"]).status,
    ).toBe("running");
  });

  it("empty stages -> ready", () => {
    expect(derivePlanStatusFromStages([]).status).toBe("ready");
  });
});
