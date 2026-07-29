/**
 * SSH live 脚本渲染单测（F383 P0-A）。
 * 覆盖 secretEnvExport → export 行注入：真实值进入内存脚本、命令里的 $DEVPILOT_*
 * 引用被 export 包裹；以及无 secretEnvExport 时行为不变。
 */
import { buildSshLiveScript } from "./ssh-live-script.utils";
import type { ServerExecutionInput } from "../server-executor.types";

const SECRET_DB = "mysql://root:Devpilot@2025@host:3306/db";
const SECRET_REDIS = "redis-secret-value";

function makeInput(
  steps: ServerExecutionInput["steps"],
): ServerExecutionInput {
  return {
    teamId: "team-1",
    userId: "user-1",
    operationKey: "release_stage.schema_migration",
    adapterKey: "ssh-live",
    dryRun: false,
    target: { transport: "ssh", serverId: "s-1", serverHost: "h", port: 22, username: "u", authType: "password" },
    steps,
    warnings: [],
    metadata: {},
  };
}

describe("buildSshLiveScript — secretEnvExport injection", () => {
  it("emits export lines for secretEnvExport values before the command", () => {
    const input = makeInput([
      {
        key: "migration",
        label: "migration",
        command: 'docker run -e DATABASE_URL="$DEVPILOT_DATABASE_URL" app migrate',
        cwd: "/app",
        required: true,
        secretEnvExport: { DEVPILOT_DATABASE_URL: SECRET_DB },
      },
    ]);
    const script = buildSshLiveScript(input);
    // export line present with the real value (memory-only script, never persisted).
    expect(script).toContain("export DEVPILOT_DATABASE_URL=");
    expect(script).toContain(SECRET_DB);
    // export precedes the docker command inside the subshell.
    const exportIdx = script.indexOf("export DEVPILOT_DATABASE_URL=");
    const cmdIdx = script.indexOf("docker run -e DATABASE_URL=");
    expect(exportIdx).toBeGreaterThan(-1);
    expect(cmdIdx).toBeGreaterThan(exportIdx);
  });

  it("emits multiple export lines when several secrets are present", () => {
    const input = makeInput([
      {
        key: "seed",
        label: "seed",
        command: 'docker run -e DATABASE_URL="$DEVPILOT_DATABASE_URL" -e REDISCLI_AUTH="$DEVPILOT_REDISCLI_AUTH" app seed',
        cwd: "",
        required: true,
        secretEnvExport: {
          DEVPILOT_DATABASE_URL: SECRET_DB,
          DEVPILOT_REDISCLI_AUTH: SECRET_REDIS,
        },
      },
    ]);
    const script = buildSshLiveScript(input);
    expect(script).toContain("export DEVPILOT_DATABASE_URL=");
    expect(script).toContain("export DEVPILOT_REDISCLI_AUTH=");
    expect(script).toContain(SECRET_DB);
    expect(script).toContain(SECRET_REDIS);
  });

  it("does not emit any export line when secretEnvExport is absent", () => {
    const input = makeInput([
      { key: "precheck", label: "precheck", command: "echo ok", cwd: "", required: true },
    ]);
    const script = buildSshLiveScript(input);
    expect(script).not.toContain("export DEVPILOT_");
  });

  it("single-quotes values containing shell metacharacters (no injection)", () => {
    const tricky = "a'b;rm -rf /";
    const input = makeInput([
      {
        key: "x",
        label: "x",
        command: 'echo "$DEVPILOT_X"',
        cwd: "",
        required: true,
        secretEnvExport: { DEVPILOT_X: tricky },
      },
    ]);
    const script = buildSshLiveScript(input);
    // The dangerous substring must be neutralized inside single quotes; no bare `rm -rf` command.
    expect(script).toContain("export DEVPILOT_X=");
    expect(script).not.toMatch(/rm -rf \/[^'"]/);
  });
});
describe("buildSshLiveScript — heredoc-aware indent (secretEnv write-env)", () => {
  it("does NOT indent heredoc body/terminator of the write-env command", () => {
    const SECRET = "s3cret";
    const input = makeInput([
      {
        key: "write_env",
        label: "写入环境配置",
        command: 'cat > .env <<\'DEVPLOT_ENV_EOF\'\nKEY=***REDACTED***\nDEVPLOT_ENV_EOF',
        cwd: "/workspace/app",
        required: true,
        secretEnv: { KEY: SECRET },
      },
    ]);
    const script = buildSshLiveScript(input);
    // heredoc terminator must appear at column 0 (preceded only by newline, no leading spaces)
    // so bash closes it. Terminator is randomized (DEVPLOT_ENV_EOF_<hex>).
    expect(script).toMatch(/\nDEVPLOT_ENV_EOF_[0-9a-f]{6,}/);
    // the body line must NOT be indented with the 2-space step indent either.
    expect(script).toContain("\nKEY=s3cret\n");
  });
});
