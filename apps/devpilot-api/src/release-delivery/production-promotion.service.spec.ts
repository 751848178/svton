import { ReleaseGateBlockedException } from "./release-gate-decision.service";
import { ProductionPromotionService } from "./production-promotion.service";

describe("Production promotion resume", () => {
  it("keeps the candidate awaiting when exact manual gates are not confirmed", async () => {
    const deps = fixture();
    deps.gates.promote.mockRejectedValue(
      new ReleaseGateBlockedException(decision(false) as never),
    );
    const result = await deps.service.resume(input());

    expect(result).toMatchObject({ status: "blocked", awaitingValidation: true });
    expect(deps.gates.promote).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseRunId: "release-1",
        deploymentRunId: "deployment-1",
        candidateHash: "f".repeat(64),
        promotionCommandId: "command-1",
      }),
    );
    expect(deps.commands.finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: "blocked" }),
    );
    expect(deps.routeSaga.apply).not.toHaveBeenCalled();
    expect(deps.completion.complete).not.toHaveBeenCalled();
  });

  it("switches route only after pre-route gates and completes after P09", async () => {
    const deps = fixture();
    await deps.service.resume(input());

    expect(deps.gates.promote.mock.invocationCallOrder[0])
      .toBeLessThan(deps.routeSaga.apply.mock.invocationCallOrder[0]);
    expect(deps.observations.record).toHaveBeenCalledWith(
      expect.objectContaining({ candidateHash: "f".repeat(64) }),
    );
    expect(deps.gates.postRoute.mock.invocationCallOrder[0])
      .toBeGreaterThan(deps.observations.record.mock.invocationCallOrder[0]);
    expect(deps.completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStatus: "awaiting_validation",
        status: "completed",
        promotionCommand: expect.objectContaining({ id: "command-1" }),
      }),
    );
  });

  it("compensates a switched route before recording terminal failure", async () => {
    const deps = fixture();
    deps.siteProbe.probe.mockResolvedValue({ ...probe(), finalUrl: null });
    await deps.service.resume(input());

    expect(deps.routeSaga.compensate).toHaveBeenCalledWith(
      expect.stringContaining("site-route:deployment-1:"),
      expect.anything(),
    );
    expect(deps.completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it.each([
    ["reserved", 1, 1, 1],
    ["pre_gate_allowed", 0, 1, 1],
    ["route_switched", 0, 1, 1],
    ["observed", 0, 0, 1],
    ["post_gate_allowed", 0, 0, 0],
  ])("resumes phase %s without replaying completed evidence side effects",
    async (phase, preCalls, probeCalls, postCalls) => {
      const deps = fixture();
      deps.commands.reserve.mockResolvedValue(reservation(phase));
      await deps.service.resume(input());
      expect(deps.gates.promote).toHaveBeenCalledTimes(preCalls);
      expect(deps.siteProbe.probe).toHaveBeenCalledTimes(probeCalls);
      expect(deps.gates.postRoute).toHaveBeenCalledTimes(postCalls);
      expect(deps.routeSaga.apply).toHaveBeenCalledTimes(1);
      expect(deps.completion.complete).toHaveBeenCalledTimes(1);
    });

  it("stops a reclaimed command before side effects when provider readback is unknown", async () => {
    const deps = fixture();
    deps.commands.reserve.mockResolvedValue({
      ...reservation("route_switched"),
      recovered: true,
    });
    deps.routeReadback.inspect.mockResolvedValue("unknown");
    await expect(deps.service.resume(input())).rejects.toThrow(
      "PRODUCTION_PROMOTION_RECOVERY_PENDING_READBACK",
    );
    expect(deps.routeSaga.apply).not.toHaveBeenCalled();
    expect(deps.completion.complete).not.toHaveBeenCalled();
  });
});

function fixture() {
  const commands = {
    reserve: jest.fn().mockResolvedValue(reservation()),
    finish: jest.fn().mockResolvedValue({ count: 1 }),
    heartbeat: jest.fn().mockResolvedValue(undefined),
    advance: jest.fn().mockResolvedValue(undefined),
  };
  const gates = {
    promote: jest.fn().mockResolvedValue(decision(true, "pre")),
    postRoute: jest.fn().mockResolvedValue(decision(true, "post")),
  };
  const routeActivation = { resolve: jest.fn().mockResolvedValue(activation()) };
  const routeSaga = {
    apply: jest.fn().mockResolvedValue(attempt()),
    compensate: jest.fn().mockResolvedValue("compensated"),
  };
  const routeReadback = { inspect: jest.fn().mockResolvedValue("switched") };
  const siteProbe = { probe: jest.fn().mockResolvedValue(probe()) };
  const observations = {
    record: jest.fn().mockResolvedValue(undefined),
    loadExact: jest.fn().mockResolvedValue({ probe: probe() }),
  };
  const completion = {
    complete: jest.fn((value) => Promise.resolve(value)),
  };
  return {
    commands, gates, routeSaga, routeReadback, siteProbe, observations, completion,
    service: new ProductionPromotionService(
      commands as never, gates as never, routeActivation as never,
      routeSaga as never, routeReadback as never, siteProbe as never, observations as never,
      completion as never,
    ),
  };
}

function input() {
  return {
    teamId: "team-1", projectId: "project-1", actorId: "actor-2",
    environmentId: "environment-1", releaseRunId: "release-1",
    deploymentRunId: "deployment-1", candidateHash: "f".repeat(64),
    idempotencyKey: "resume-0001",
  };
}

function reservation(phase = "reserved") {
  const hasPre = phase !== "reserved";
  const hasPost = phase === "post_gate_allowed" || phase === "committing";
  return {
    command: {
      id: "command-1", status: "running", phase,
      preDecisionId: hasPre ? "decision-pre" : null,
      preDecisionInputHash: hasPre ? "preprepre" : null,
      preDecisionActionHash: hasPre ? "pre-action" : null,
      postDecisionId: hasPost ? "decision-post" : null,
      postDecisionInputHash: hasPost ? "postpostpost" : null,
      postDecisionActionHash: hasPost ? "post-action" : null,
      routeSwitchOperationId: hasPre ? "site-route:deployment-1:site-1" : null,
    },
    candidate: {
      ...input(), version: 1, releaseOrderId: "order-1",
      configRevisionId: "config-1", manifestId: "manifest-1",
      manifestDigest: `sha256:${"a".repeat(64)}`, buildRunId: "build-1",
      providerKey: "ssh-v1", bindingId: "binding-1",
      deploymentInputHash: "b".repeat(64), workloadInputHash: "c".repeat(64),
      workloadServiceCount: 1, workloadHealthConfigured: true,
      targetRef: "server-1", kind: "upgrade",
    },
    routeSnapshot: { domains: ["app.example.com"], tlsRequired: true },
    deploymentResult: { workloadReady: { status: "passed" } },
    deploymentLogs: ["deployed"],
    shouldExecute: true,
    recovered: false,
    lease: {
      owner: "owner-1", token: "token-1", tokenHash: "token-hash-1",
      expiresAt: new Date("2099-08-11T00:00:00.000Z"),
    },
  };
}

function activation() {
  return {
    siteId: "site-1", primaryDomain: "app.example.com",
    domains: ["app.example.com"], entries: [],
    proxyTarget: "http://server-1:8080", status: "matched",
    reasonCode: "site_route_matched",
  };
}

function attempt() {
  return { evidence: {
    version: 1, operationId: "site-route:deployment-1:site-1",
    teamId: "team-1", projectId: "project-1", environmentId: "environment-1",
    siteId: "site-1", deploymentRunId: "deployment-1", releaseRunId: "release-1",
    primaryDomain: "app.example.com", domains: ["app.example.com"], entries: [],
    proxyTarget: "http://server-1:8080", targetRef: "server-1", routeHash: "route",
    expectedCurrent: null, providerKey: "test", status: "switched",
    reasonCode: "switched", switchedAt: "2026-08-11T00:00:00.000Z", receipt: {},
  } };
}

function probe() {
  const checkedAt = "2026-08-11T00:00:00.000Z";
  return {
    version: 1, primaryDomain: "app.example.com",
    finalUrl: "https://app.example.com/", probedAt: checkedAt,
    dns: { status: "resolved", checkedAt },
    tls: { status: "valid", checkedAt },
    http: { status: "passed", statusCode: 200, url: "https://app.example.com/", finalUrl: "https://app.example.com/", checkedAt },
  };
}

function decision(allowed: boolean, id = "manual") {
  return {
    id: `decision-${id}`, stage: "production", inputHash: id.repeat(8), allowed,
    actionInputHash: `${id}-action`,
    blockerGateIds: [], manualGateIds: allowed ? [] : ["P03"],
  };
}
