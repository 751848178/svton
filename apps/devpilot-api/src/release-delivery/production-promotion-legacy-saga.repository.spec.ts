import { resolveLegacyPromotionSaga } from "./production-promotion-legacy-saga.repository";

describe("legacy promotion exact saga resolution", () => {
  it.each([
    [[], "none_safe", "prepare_before_provider"],
    [[], "none_blocked", "pre_lease_phase_unverifiable"],
    [[{ operationId: "route-1", providerKey: "provider-1" }], "unique", null],
    [[{ operationId: "route-1", providerKey: "provider-1" },
      { operationId: "route-2", providerKey: "provider-1" }], "ambiguous", null],
  ] as const)("resolves exact saga rows as %s", async (rows, expected, reason) => {
    const findMany = jest.fn().mockResolvedValue(rows);
    const value = await resolveLegacyPromotionSaga(
      { siteRouteSwitchRun: { findMany } } as never,
      promotion(reason), candidate() as never,
    );
    expect(value.kind).toBe(expected);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      teamId: "team-1", projectId: "project-1", environmentId: "production-1",
      releaseRunId: "release-1", deploymentRunId: "deployment-1", targetRef: "target-1",
    }, take: 2 }));
  });
});

function promotion(reason: string | null) {
  return { teamId: "team-1", projectId: "project-1", releaseRunId: "release-1",
    deploymentRunId: "deployment-1", phase: "legacy_reconcile_required",
    attemptCount: 0, routeSwitchOperationId: null, legacyReconcileReason: reason };
}
function candidate() {
  return { environmentId: "production-1", targetRef: "target-1" };
}
