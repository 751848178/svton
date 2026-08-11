import { ConflictException } from "@nestjs/common";
import { reserveEnvironmentVersionAction } from "./environment-version-action-reservation.repository";
import { replayEnvironmentVersionAction } from "./environment-version-action-replay.repository";

describe("environment version action reservation", () => {
  it("allows a blocked action to be attempted again with a new key", async () => {
    const tx = transaction();
    const blocked = await reserveEnvironmentVersionAction(tx as never, input());
    tx.rows.get("action-1")!.status = "blocked";
    const retry = await reserveEnvironmentVersionAction(
      tx as never,
      input({ idempotencyKey: "action-2" }),
    );

    expect(blocked.id).not.toBe(retry.id);
    expect(tx.deploymentRun.create).toHaveBeenCalledTimes(2);
  });

  it("rejects input drift for the same idempotency key", async () => {
    const tx = transaction();
    await reserveEnvironmentVersionAction(tx as never, input());

    await expect(
      reserveEnvironmentVersionAction(
        tx as never,
        input({ inputHash: "b".repeat(64) }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows a second action for the same manifest with a new key", async () => {
    const tx = transaction();
    const first = await reserveEnvironmentVersionAction(tx as never, input());
    const second = await reserveEnvironmentVersionAction(
      tx as never,
      input({ idempotencyKey: "action-2" }),
    );

    expect(first.artifactManifestId).toBe(second.artifactManifestId);
    expect(first.id).not.toBe(second.id);
  });

  it("rejects a second actor reusing the same project idempotency key", async () => {
    const tx = transaction();
    await reserveEnvironmentVersionAction(tx as never, input());

    await expect(
      replayEnvironmentVersionAction(tx as never, {
        teamId: "team-1",
        projectId: "project-1",
        actorId: "user-2",
        environmentId: "staging-1",
        idempotencyKey: "action-1",
        requestHash: "request-a",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects raw request drift before mutable policy evaluation", async () => {
    const tx = transaction();
    await reserveEnvironmentVersionAction(tx as never, input());

    await expect(
      replayEnvironmentVersionAction(tx as never, {
        teamId: "team-1",
        projectId: "project-1",
        actorId: "user-1",
        environmentId: "staging-1",
        idempotencyKey: "action-1",
        requestHash: "request-b",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rechecks an unresolved route saga inside the reservation transaction", async () => {
    const tx = transaction();
    tx.siteRouteSwitchRun.findFirst.mockResolvedValue({
      operationId: "route-operation-1",
      status: "compensation_required",
    });

    await expect(
      reserveEnvironmentVersionAction(tx as never, input()),
    ).rejects.toThrow("compensation_required");

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.deploymentRun.create).not.toHaveBeenCalled();
  });
});

function input(overrides: Record<string, unknown> = {}) {
  return {
    teamId: "team-1",
    projectId: "project-1",
    actorId: "user-1",
    environmentId: "staging-1",
    configRevisionId: "config-1",
    manifestId: "manifest-1",
    releaseOrderId: "order-1",
    idempotencyKey: "action-1",
    inputHash: "a".repeat(64),
    requestHash: "request-a",
    mode: "deploy" as const,
    branch: "main",
    commitSha: "c".repeat(40),
    params: {},
    providerKey: "ssh-v1",
    ...overrides,
  };
}

function transaction() {
  const rows = new Map<string, Record<string, unknown>>();
  const deploymentRun = {
    findUnique: jest.fn(({ where }) =>
      Promise.resolve(
        rows.get(where.projectId_idempotencyKey.idempotencyKey) ?? null,
      ),
    ),
    findUniqueOrThrow: jest.fn(({ where }) =>
      Promise.resolve(rows.get(where.projectId_idempotencyKey.idempotencyKey)),
    ),
    create: jest.fn(({ data }) => {
      const row = {
        id: `run-${rows.size + 1}`,
        ...data,
        releaseRunId: data.releaseRunId ?? null,
        environmentVersion: null,
      };
      rows.set(data.idempotencyKey, row);
      return Promise.resolve(row);
    }),
  };
  return {
    rows,
    deploymentRun,
    siteRouteSwitchRun: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ id: "order-1", status: "draft" }]),
  };
}
