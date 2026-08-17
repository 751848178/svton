import { ConflictException } from "@nestjs/common";
import { lockExactLegacyPromotionSaga } from
  "./production-promotion-reconcile-saga-lock.repository";

describe("legacy promotion saga transaction lock", () => {
  it("CAS-terminates prepared before allowing promotion termination", async () => {
    const tx = fixture([route("prepared")]);
    await expect(run(tx)).resolves.toMatchObject({ status: "failed" });
    expect(tx.siteRouteSwitchRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "saga-1", status: "prepared" },
      data: expect.objectContaining({ status: "failed" }),
    }));
  });

  it.each(["compensated", "failed"])("accepts locked terminal %s", async (status) => {
    const tx = fixture([route(status)]);
    await expect(run(tx)).resolves.toMatchObject({ status });
    expect(tx.siteRouteSwitchRun.updateMany).not.toHaveBeenCalled();
  });

  it.each(["applying", "switched", "committed"])("quarantines conflicting %s", async (status) => {
    await expect(run(fixture([route(status)]))).rejects.toBeInstanceOf(ConflictException);
  });

  it("fails closed on concurrent CAS loss or ambiguous exact scope", async () => {
    const lost = fixture([route("prepared")], 0);
    await expect(run(lost)).rejects.toBeInstanceOf(ConflictException);
    await expect(run(fixture([route("failed"), { ...route("failed"), id: "saga-2" }])))
      .rejects.toBeInstanceOf(ConflictException);
  });
});

function run(tx: ReturnType<typeof fixture>) {
  return lockExactLegacyPromotionSaga(tx as never, scope(), candidate(), readback(), "not_switched");
}
function fixture(rows: unknown[], count = 1) {
  return { $queryRaw: jest.fn().mockResolvedValue(rows), siteRouteSwitchRun: {
    updateMany: jest.fn().mockResolvedValue({ count }),
  } };
}
function route(status: string) {
  return { id: "saga-1", operationId: "operation-1", providerKey: "ssh-v1", status };
}
function scope() {
  return { teamId: "team-1", projectId: "project-1",
    releaseRunId: "release-1", deploymentRunId: "deployment-1" };
}
function candidate() {
  return { environmentId: "production-1", targetRef: "server-1" } as never;
}
function readback() {
  return { operationId: "operation-1", providerKey: "ssh-v1",
    state: "not_switched" } as const;
}
