import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeAgentTaskPullStep } from "../utils/agent-task-pull-executor";

describe("agent task-pull executor", () => {
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

  it("marks stdout and stderr when command output is truncated", async () => {
    const result = await executeAgentTaskPullStep(
      {
        key: "large-output",
        command:
          "node -e \"process.stdout.write('a'.repeat(16005)); process.stderr.write('b'.repeat(16006))\"",
      },
      {},
    );

    expect(result).toMatchObject({
      key: "large-output",
      exitCode: 0,
      timedOut: false,
      stdoutTruncated: true,
      stderrTruncated: true,
    });
    expect(result.stdout).toHaveLength(16000);
    expect(result.stderr).toHaveLength(16000);
  });

  it("returns a failed result when the child process cannot spawn", async () => {
    const root = mkdtempSync(join(tmpdir(), "svton-agent-spawn-"));

    try {
      const result = await executeAgentTaskPullStep(
        {
          key: "missing-cwd",
          command: 'node -e "process.stdout.write(`should-not-run`)"',
          cwd: "missing",
        },
        { cwd: root },
      );

      expect(result).toMatchObject({
        key: "missing-cwd",
        exitCode: null,
        stdout: "",
        timedOut: false,
      });
      expect(result.stderr).toContain("spawn_error");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("force kills a cancelled command step that ignores SIGTERM", async () => {
    if (process.platform === "win32") {
      return;
    }

    const controller = new AbortController();
    const running = executeAgentTaskPullStep(
      {
        key: "ignore-term",
        command:
          "exec node -e \"process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)\"",
      },
      { signal: controller.signal, forceKillGraceMs: 20 },
    );

    setTimeout(() => controller.abort(), 10);
    const result = await running;

    expect(result).toMatchObject({
      key: "ignore-term",
      exitCode: null,
      timedOut: false,
      cancelled: true,
    });
  });
});
