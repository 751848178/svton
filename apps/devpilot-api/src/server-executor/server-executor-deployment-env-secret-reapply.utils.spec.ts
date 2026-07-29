import { reapplyDeploymentEnvWriteSecrets } from "./server-executor-deployment-env-secret-reapply.utils";
import type { ServerExecutionInput } from "./server-executor.types";

const REDED = "cat > .env <<'DEVPLOT_ENV_EOF'\nDATABASE_URL=***REDACTED***\nJWT_SECRET=***REDACTED***\nDEVPLOT_ENV_EOF";

function mkInput(steps: ServerExecutionInput["steps"], metadata: Record<string, unknown> = {}): ServerExecutionInput {
  return {
    teamId: "team-1",
    userId: "u-1",
    operationKey: "deployment.run",
    adapterKey: "deployment-script-plan",
    dryRun: false,
    target: { transport: "ssh", serverId: "s-1", serverHost: "h", port: 22, username: "u", authType: "password" },
    steps,
    warnings: [],
    metadata,
  };
}

describe("reapplyDeploymentEnvWriteSecrets", () => {
  it("re-resolves .env secrets for a write_env step missing secretEnv", async () => {
    const resolver = jest.fn().mockResolvedValue({
      DATABASE_URL: "mysql://real@host/db",
      JWT_SECRET: "real-jwt",
      OTHER: "unused",
    });
    const input = mkInput([
      { key: "write_env", label: "env", command: REDED, cwd: "/w", required: true } as never,
    ], { projectId: "p-1", environmentId: "e-1" });

    const out = await reapplyDeploymentEnvWriteSecrets(input, resolver as never);
    expect(resolver).toHaveBeenCalledWith("team-1", "p-1", "e-1");
    const step = out.steps[0] as { secretEnv?: Record<string, string>; command: string };
    expect(step.secretEnv).toEqual({
      DATABASE_URL: "mysql://real@host/db",
      JWT_SECRET: "real-jwt",
    });
    // command stays as the redacted form (zero-leak: real values live only in secretEnv,
    // rendered to a real heredoc in-memory by the ssh-live script builder at execution time)
    expect(step.command).toBe(REDED);
    expect(step.command).toContain("***REDACTED***");
  });

  it("returns input unchanged when no write_env step", async () => {
    const resolver = jest.fn();
    const input = mkInput([
      { key: "checkout", label: "git", command: "git pull", cwd: "/w", required: true } as never,
    ]);
    const out = await reapplyDeploymentEnvWriteSecrets(input, resolver as never);
    expect(out).toBe(input);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("does not overwrite a step that already carries secretEnv", async () => {
    const resolver = jest.fn();
    const input = mkInput([
      { key: "write_env", label: "env", command: REDED, cwd: "/w", required: true, secretEnv: { DATABASE_URL: "already" } } as never,
    ]);
    const out = await reapplyDeploymentEnvWriteSecrets(input, resolver as never);
    expect((out.steps[0] as { secretEnv: Record<string, string> }).secretEnv).toEqual({ DATABASE_URL: "already" });
    expect(resolver).not.toHaveBeenCalled();
  });

  it("returns input unchanged when resolver yields no matching keys", async () => {
    const resolver = jest.fn().mockResolvedValue({ UNRELATED: "x" });
    const input = mkInput([
      { key: "write_env", label: "env", command: REDED, cwd: "/w", required: true } as never,
    ], { projectId: "p-1", environmentId: "e-1" });
    const out = await reapplyDeploymentEnvWriteSecrets(input, resolver as never);
    expect(out).toBe(input);
  });
});
