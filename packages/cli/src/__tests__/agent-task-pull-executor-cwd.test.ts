import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeAgentTaskPullStep } from "../utils/agent-task-pull-executor";

describe("agent task-pull executor cwd boundary", () => {
  it("runs a relative step cwd inside the configured execution base", async () => {
    const root = mkdtempSync(join(tmpdir(), "svton-agent-cwd-"));
    const workspace = join(root, "workspace");
    mkdirSync(workspace);

    try {
      const result = await executeAgentTaskPullStep(
        {
          key: "cwd",
          command: 'node -e "process.stdout.write(process.cwd())"',
          cwd: "workspace",
        },
        { cwd: root },
      );

      expect(result).toMatchObject({
        key: "cwd",
        exitCode: 0,
        timedOut: false,
      });
      expect(result.stdout).toBe(realpathSync(workspace));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails a step cwd that escapes the configured execution base", async () => {
    const root = mkdtempSync(join(tmpdir(), "svton-agent-cwd-"));
    const workspace = join(root, "workspace");
    mkdirSync(workspace);

    try {
      const result = await executeAgentTaskPullStep(
        {
          key: "cwd",
          command: 'node -e "process.stdout.write(`should-not-run`)"',
          cwd: "..",
        },
        { cwd: workspace },
      );

      expect(result).toMatchObject({
        key: "cwd",
        exitCode: 1,
        stdout: "",
        timedOut: false,
      });
      expect(result.stderr).toContain("step_cwd_outside_execution_base");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
