import { ConfigService } from "@nestjs/config";
import { ReleaseExecutorPreflightService } from "./release-executor-preflight.service";

/**
 * F383 §B — release preview executor-capability preflight unit tests.
 * Verifies incompatible servers are surfaced as non-blocking warnings
 * (live disabled / unsupported authType / missing server) and compatible
 * configs produce no warnings.
 */
function buildDeps(opts: {
  liveEnabled?: string | boolean;
  servers?: Array<{ id: string; authType: string; name?: string }>;
}) {
  const servers = opts.servers ?? [];
  const findFirst = jest.fn(({ where }: { where: { id: string; teamId: string } }) =>
    Promise.resolve(servers.find((s) => s.id === where.id) ?? null),
  );
  const prisma = { server: { findFirst } } as never;
  const configService = {
    get: jest.fn((key: string, fb?: unknown) =>
      key === "SERVER_EXECUTOR_LIVE_ENABLED"
        ? opts.liveEnabled ?? "true"
        : fb,
    ),
  } as unknown as ConfigService;
  const svc = new ReleaseExecutorPreflightService(prisma, configService);
  return { svc, findFirst };
}

const svc = (id: string, serverId?: string) => ({
  applicationServiceId: `app-${id}`,
  serviceName: id,
  serverId: serverId ?? null,
});

describe("ReleaseExecutorPreflightService", () => {
  it("produces no warnings when live enabled + supported authType", async () => {
    const { svc: s } = buildDeps({
      liveEnabled: "true",
      servers: [{ id: "srv-1", authType: "password" }],
    });
    const warnings = await s.computeWarnings("t1", [svc("be", "srv-1")]);
    expect(warnings).toEqual([]);
  });

  it("warns when live executor is disabled", async () => {
    const { svc: s } = buildDeps({
      liveEnabled: "false",
      servers: [{ id: "srv-1", authType: "password" }],
    });
    const warnings = await s.computeWarnings("t1", [svc("be", "srv-1")]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toContain("live executor disabled");
    expect(warnings[0].suggestedAction).toContain("SERVER_EXECUTOR_LIVE_ENABLED");
  });

  it("warns on unsupported authType", async () => {
    const { svc: s } = buildDeps({
      servers: [{ id: "srv-1", authType: "otp", name: "box" }],
    });
    const warnings = await s.computeWarnings("t1", [svc("be", "srv-1")]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toContain("unsupported authType");
    expect(warnings[0].suggestedAction).toContain("box");
  });

  it("warns when the server record is missing", async () => {
    const { svc: s } = buildDeps({ servers: [] });
    const warnings = await s.computeWarnings("t1", [svc("be", "srv-gone")]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toContain("server record not found");
  });

  it("dedupes warnings per server across multiple services", async () => {
    const { svc: s } = buildDeps({
      liveEnabled: "false",
      servers: [{ id: "srv-1", authType: "password" }],
    });
    const warnings = await s.computeWarnings("t1", [
      svc("be", "srv-1"),
      svc("admin", "srv-1"),
    ]);
    expect(warnings).toHaveLength(1);
  });

  it("ignores services without a serverId", async () => {
    const { svc: s, findFirst } = buildDeps({ servers: [] });
    const warnings = await s.computeWarnings("t1", [svc("be")]);
    expect(warnings).toEqual([]);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
