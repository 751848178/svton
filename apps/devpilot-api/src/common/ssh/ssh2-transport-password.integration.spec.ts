import { Ssh2Transport } from "./ssh2-transport";
import { SSH_CAPABILITY_PROBE_COMMAND } from "../../server-executor/adapters/ssh-credential-mapping.utils";

/**
 * F383 §A/§H — password SSH live 集成测试（真实 sshd）。
 *
 * 针对 `docker-compose.deploy-target.yml` 的 password-auth 目标（host 2225）
 * 与 key-auth 目标（host 2224）做真实连接，验证 transport 层确实支持 password：
 *  - 正确密码 → 最小命令 `true` 返回 exit 0
 *  - 错误密码 → 认证失败错误语义（不被误判为成功）
 *  - key auth 对等保护（不回归）
 *
 * 默认跳过（与 release 集成测试同构）：需显式 RUN_SSH_INTEGRATION=1 或端口可达。
 * 启动：
 *   docker compose -f docker-compose.deploy-target.yml up -d deploy-target-password
 *   RUN_SSH_INTEGRATION=1 npx jest src/common/ssh/ssh2-transport-password.integration.spec.ts
 */
const PW_HOST = process.env.SSH_PW_HOST ?? "127.0.0.1";
const PW_PORT = Number(process.env.SSH_PW_PORT ?? "2225");
const KEY_HOST = process.env.SSH_KEY_HOST ?? PW_HOST;
const KEY_PORT = Number(process.env.SSH_KEY_PORT ?? String(PW_PORT));
const TEST_PASSWORD = process.env.SSH_PW_PASSWORD ?? "devpilot-test";

const forced = process.env.RUN_SSH_INTEGRATION === "1";

async function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("net");
    const socket = new net.Socket();
    socket.setTimeout(2500);
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

// 默认 skip：仅在 RUN_SSH_INTEGRATION=1（且容器可达）时执行，避免污染默认 jest。
const describeIntegration = (forced ? describe : describe.skip) as jest.Describe;

describeIntegration("Ssh2Transport password auth (real sshd)", () => {
  beforeAll(async () => {
    const pwOpen = await isPortOpen(PW_HOST, PW_PORT);
    const keyOpen = await isPortOpen(KEY_HOST, KEY_PORT);
    if (!pwOpen || !keyOpen) {
      // RUN_SSH_INTEGRATION=1 但容器未起时明确失败（而非静默通过）。
      throw new Error(
        `SSH integration targets not reachable: password(${PW_HOST}:${PW_PORT})=${pwOpen} key(${KEY_HOST}:${KEY_PORT})=${keyOpen}. ` +
          `Run: docker compose -f docker-compose.deploy-target.yml up -d deploy-target deploy-target-password`,
      );
    }
  }, 15000);

  it("authenticates with the correct password and runs the minimal command", async () => {
    const transport = new Ssh2Transport({
      host: PW_HOST,
      port: PW_PORT,
      username: "deploy",
      password: TEST_PASSWORD,
    });
    try {
      const result = await transport.execCommand(SSH_CAPABILITY_PROBE_COMMAND, {
        timeoutMs: 10000,
      });
      expect(result.exitCode).toBe(0);
    } finally {
      transport.dispose();
    }
  }, 20000);

  it("fails closed on a wrong password (auth-failure error, not success)", async () => {
    const transport = new Ssh2Transport({
      host: PW_HOST,
      port: PW_PORT,
      username: "deploy",
      password: "definitely-wrong-password",
    });
    try {
      await expect(
        transport.execCommand(SSH_CAPABILITY_PROBE_COMMAND, { timeoutMs: 10000 }),
      ).rejects.toThrow(/auth|All configured authentication/i);
    } finally {
      transport.dispose();
    }
  }, 20000);

  it("still supports key auth against the key-only target (parity guard)", async () => {
    // key 内容由 docker-compose.deploy-target.yml 注入；测试仅校验 transport 支持 key。
    const keyPath = "/tmp/codex-tool-runs/svton/dataplane/integ-test-key";
    const fs = await import("fs");
    let privateKey: string;
    try {
      privateKey = fs.readFileSync(keyPath, "utf8");
    } catch {
      // key 未生成时跳过该 parity 用例，但不让整个集成套件变绿——改用 fail。
      throw new Error(`key file missing: ${keyPath}`);
    }
    const transport = new Ssh2Transport({
      host: KEY_HOST,
      port: KEY_PORT,
      username: "deploy",
      privateKey,
    });
    try {
      const result = await transport.execCommand(SSH_CAPABILITY_PROBE_COMMAND, {
        timeoutMs: 10000,
      });
      expect(result.exitCode).toBe(0);
    } finally {
      transport.dispose();
    }
  }, 20000);
});
