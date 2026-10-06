import {
  productionApprovalRequired,
  productionPromotionRequired,
  releaseGateCheckpointPolicy,
} from "./release-gate-checkpoint.policy";

describe("release gate checkpoint policy", () => {
  it("keeps the basic production path limited to deploy prerequisites", () => {
    expect(
      releaseGateCheckpointPolicy("production_pre_execution", "basic_v1")
        .requiredGateIds,
    ).toEqual(["D01", "D02", "D03"]);
    expect(
      releaseGateCheckpointPolicy("production_post_deploy", "basic_v1")
        .requiredGateIds,
    ).toEqual([]);
    expect(productionApprovalRequired("basic_v1")).toBe(false);
    expect(productionPromotionRequired("basic_v1")).toBe(false);
  });

  it("retains approval, promotion, and the full gate set for governed releases", () => {
    expect(
      releaseGateCheckpointPolicy("production_pre_execution", "governed_v1")
        .requiredGateIds,
    ).toHaveLength(19);
    expect(productionApprovalRequired("governed_v1")).toBe(true);
    expect(productionPromotionRequired("governed_v1")).toBe(true);
  });
});
