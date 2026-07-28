import { ConfigService } from "@nestjs/config";
import { ServerConnectionCapabilityService } from "./server-connection-capability.service";
import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { SshTransport } from "../common/ssh/ssh-transport";

/**
 * F383 §B — server connection capability service unit tests.
 *
 * Covers the three-way split (network / auth / executor-compat), actionable
 * recommendations, the no-fake-success invariant, and that plaintext secrets
 * never appear in any returned message. The TCP check is stubbed via subclassing
 * so auth/executor logic is deterministic.
 */

interface DepsOpts {
  authType?: string;
  liveEnabled?: string | boolean;
  execResult?: { exitCode: number | null; stderr: string };
  execThrows?: Error;
  networkReachable?: boolean;
}

function buildDeps(opts: DepsOpts = {}) {
  const SECRET = "DECRYPTED-SECRET";
  const prisma = {
    server: {
      findFirst: jest.fn().mockResolvedValue({
        id: "s1",
        teamId: "t1",
        name: "box",
        host: "10.0.0.10",
        port: 22,
        username: "deploy",
        authType: opts.authType ?? "password",
        credentials: "ENC",
      }),
    },
  };
  const cryptoService = { decryptGcm: jest.fn().mockReturnValue(SECRET) };
  const transport = {
    execCommand: opts.execThrows
      ? jest.fn().mockRejectedValue(opts.execThrows)
      : jest.fn().mockResolvedValue(opts.execResult ?? { exitCode: 0, stderr: "" }),
    dispose: jest.fn(),
  } as unknown as SshTransport;
  const createMock = jest.fn().mockReturnValue(transport);
  const sshTransportFactory = { create: createMock } as unknown as SshTransportFactory;
  const configService = {
    get: jest.fn((key: string, fb?: unknown) =>
      key === "SERVER_EXECUTOR_LIVE_ENABLED"
        ? opts.liveEnabled ?? "true"
        : fb,
    ),
  } as unknown as ConfigService;

  // Subclass to stub the network check deterministically.
  class TestableService extends ServerConnectionCapabilityService {
    protected checkPortReachable(): Promise<boolean> {
      return Promise.resolve(opts.networkReachable ?? true);
    }
  }
  const svc = new TestableService(
    prisma as never,
    cryptoService as never,
    sshTransportFactory,
    configService,
  );
  return { svc, sshTransportFactory, createMock, transport, SECRET };
}

describe("ServerConnectionCapabilityService", () => {
  it("returns fully-capable when network ok + auth ok + executor enabled", async () => {
    const { svc, createMock } = buildDeps({ authType: "password" });
    const cap = await svc.verifyCapability("t1", "s1");
    expect(cap).toMatchObject({
      networkReachable: true,
      authenticationVerified: true,
      executorCompatible: true,
    });
    // password auth maps to the password field, not privateKey
    const creds = createMock.mock.calls[0][0];
    expect(creds.password).toBe("DECRYPTED-SECRET");
    expect(creds.privateKey).toBeUndefined();
    expect(JSON.stringify(cap)).not.toContain("DECRYPTED-SECRET");
  });

  it("routes key auth into privateKey", async () => {
    const { svc, createMock } = buildDeps({ authType: "key" });
    await svc.verifyCapability("t1", "s1");
    const creds = createMock.mock.calls[0][0];
    expect(creds.privateKey).toBe("DECRYPTED-SECRET");
    expect(creds.password).toBeUndefined();
  });

  it("reports network unreachable with actionable recommendation", async () => {
    const { svc } = buildDeps({ authType: "password", networkReachable: false });
    const cap = await svc.verifyCapability("t1", "s1");
    expect(cap.networkReachable).toBe(false);
    expect(cap.authenticationVerified).toBe(false);
    expect(cap.executorCompatible).toBe(false);
    expect(cap.recommendation).toContain("主机/端口");
  });

  it("fails auth on wrong credentials (not success) and gives actionable advice", async () => {
    const { svc } = buildDeps({
      authType: "password",
      execThrows: new Error("All configured authentication methods failed"),
    });
    const cap = await svc.verifyCapability("t1", "s1");
    expect(cap.networkReachable).toBe(true);
    expect(cap.authenticationVerified).toBe(false);
    expect(cap.executorCompatible).toBe(false);
    expect(cap.recommendation).toContain("凭据");
  });

  it("marks executor-incompatible when live executor disabled (auth still verified)", async () => {
    const { svc } = buildDeps({ authType: "password", liveEnabled: "false" });
    const cap = await svc.verifyCapability("t1", "s1");
    expect(cap.authenticationVerified).toBe(true);
    expect(cap.executorCompatible).toBe(false);
    expect(cap.recommendation).toContain("SERVER_EXECUTOR_LIVE_ENABLED");
  });

  it("fails closed on unknown authType (actionable message, no secret)", async () => {
    const { svc, SECRET } = buildDeps({ authType: "otp" });
    const cap = await svc.verifyCapability("t1", "s1");
    expect(cap.authenticationVerified).toBe(false);
    expect(cap.executorCompatible).toBe(false);
    const serialized = JSON.stringify(cap);
    expect(serialized).toContain("key / password");
    expect(serialized).not.toContain(SECRET);
  });

  it("handles a non-zero probe exit code as auth-not-verified", async () => {
    const { svc } = buildDeps({
      authType: "password",
      execResult: { exitCode: 1, stderr: "" },
    });
    const cap = await svc.verifyCapability("t1", "s1");
    expect(cap.authenticationVerified).toBe(false);
    expect(cap.message).toContain("1");
  });
});
