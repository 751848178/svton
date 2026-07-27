import { spawnSync } from "node:child_process";
import type { ServerCommandStep } from "../server-executor.types";
import { buildSshLiveScript } from "./ssh-live-script.utils";
import { extractSshLiveStepEvidence } from "./ssh-live-step-evidence.utils";

const steps: ServerCommandStep[] = [
  {
    key: "migration",
    label: "数据库迁移",
    command: "false",
    required: true,
    failurePolicy: "block",
  },
  {
    key: "deploy",
    label: "启动服务",
    command: "echo deploy",
    required: true,
    failurePolicy: "block",
  },
];

describe("SSH live stage evidence", () => {
  it("emits markers and exits before later steps after a failure", () => {
    const script = buildSshLiveScript({
      teamId: "team-1",
      operationKey: "deployment.run",
      adapterKey: "deployment-script-plan",
      dryRun: false,
      target: { transport: "ssh" },
      steps,
    });

    expect(script).toContain("__DEVPILOT_STEP_START__");
    expect(script).toContain("__DEVPILOT_STEP_END__");
    expect(script.indexOf("false")).toBeLessThan(script.indexOf("echo deploy"));
    expect(script).toContain('exit "$__devpilot_step_status"');

    const execution = spawnSync("bash", ["-c", script], {
      encoding: "utf8",
    });
    expect(execution.status).toBe(1);
    expect(execution.stdout).not.toContain("deploy");
    expect(execution.stderr).toContain(
      "__DEVPILOT_STEP_END__|migration|1|",
    );
    expect(execution.stderr).not.toContain(
      "__DEVPILOT_STEP_START__|deploy|",
    );
  });

  it("strips control markers and reports completed, failed, and not-started stages", () => {
    const result = extractSshLiveStepEvidence(
      [
        "__DEVPILOT_STEP_START__|migration|100",
        "migration warning",
        "__DEVPILOT_STEP_END__|migration|1|102",
      ].join("\n"),
      steps,
    );

    expect(result.stderr).toBe("migration warning");
    expect(result.stepResults).toEqual([
      expect.objectContaining({
        key: "migration",
        status: "failed",
        exitCode: 1,
        durationMs: 2000,
      }),
      expect.objectContaining({ key: "deploy", status: "not_started" }),
    ]);
  });
});
