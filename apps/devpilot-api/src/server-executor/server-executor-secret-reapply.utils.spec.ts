/**
 * 执行边界秘密重应用单测（F383 P0-A）。
 * 覆盖：含 $DEVPILOT_* 引用时解析并写回 secretEnvExport；无引用时原样返回；
 * 解析器返回空时不写回；projectId/environmentId 从 metadata/sourceMetadata 读取。
 */
import {
  reapplySecretEnvExport,
} from "./server-executor-secret-reapply.utils";
import type { ServerExecutionInput } from "./server-executor.types";

const SECRET_DB = "mysql://user:Devpilot@2025@host:3306/db";

function makeInput(
  command: string | undefined,
  metadata: Record<string, unknown> = {},
): ServerExecutionInput {
  return {
    teamId: "team-1",
    operationKey: "release_stage.schema_migration",
    adapterKey: "ssh-live",
    dryRun: false,
    target: { transport: "ssh", serverId: "srv-1" },
    steps: command
      ? [{ key: "migration", label: "migration", command, cwd: "", required: true }]
      : [{ key: "migration", label: "migration", command: "echo ok", cwd: "", required: true }],
    warnings: [],
    metadata,
  };
}

describe("reapplySecretEnvExport", () => {
  it("resolves and reattaches secretEnvExport for steps referencing $DEVPILOT_*", async () => {
    const input = makeInput(
      'docker run -e DATABASE_URL="$DEVPILOT_DATABASE_URL" app migrate',
      { projectId: "proj-1", environmentId: "env-1" },
    );
    const resolver = async () => ({ DATABASE_URL: SECRET_DB });
    const out = await reapplySecretEnvExport(input, resolver);
    expect(out.steps[0].secretEnvExport).toEqual({
      DEVPILOT_DATABASE_URL: SECRET_DB,
    });
  });

  it("reads projectId/environmentId from sourceMetadata when top-level absent", async () => {
    const input = makeInput('echo "$DEVPILOT_DATABASE_URL"', {
      sourceMetadata: { projectId: "proj-2", environmentId: "env-2" },
    });
    const resolver = async (
      _teamId: string,
      projectId: string | null | undefined,
      environmentId: string | null | undefined,
    ) => {
      expect(projectId).toBe("proj-2");
      expect(environmentId).toBe("env-2");
      return { DATABASE_URL: SECRET_DB };
    };
    const out = await reapplySecretEnvExport(input, resolver);
    expect(out.steps[0].secretEnvExport).toEqual({ DEVPILOT_DATABASE_URL: SECRET_DB });
  });

  it("returns input unchanged when no step references $DEVPILOT_*", async () => {
    const input = makeInput("curl http://picshare-backend:3000/api");
    const resolver = async () => { throw new Error("should not be called"); };
    const out = await reapplySecretEnvExport(input, resolver);
    expect(out).toBe(input);
  });

  it("does not attach secretEnvExport when resolver returns no matching value", async () => {
    const input = makeInput(
      'docker run -e DATABASE_URL="$DEVPILOT_DATABASE_URL" app',
      { projectId: "proj-1", environmentId: "env-1" },
    );
    const resolver = async () => ({}); // secrets not provisioned
    const out = await reapplySecretEnvExport(input, resolver);
    expect(out.steps[0].secretEnvExport).toBeUndefined();
  });

  it("does not leak the real secret into the persisted command (only in secretEnvExport)", async () => {
    const input = makeInput(
      'docker run -e DATABASE_URL="$DEVPILOT_DATABASE_URL" app',
      { projectId: "proj-1", environmentId: "env-1" },
    );
    const out = await reapplySecretEnvExport(input, async () => ({ DATABASE_URL: SECRET_DB }));
    // command stays as placeholder; real value only in secretEnvExport
    expect(out.steps[0].command).toBe('docker run -e DATABASE_URL="$DEVPILOT_DATABASE_URL" app');
    expect(JSON.stringify(out.steps[0].command)).not.toContain("Devpilot@2025");
  });
});
