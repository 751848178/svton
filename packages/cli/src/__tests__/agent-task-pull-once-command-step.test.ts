import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAgentTaskPullOnce } from "../utils/agent-task-pull-runner";
import type { AgentTaskPullFinishPayload } from "../utils/agent-task-pull-types";
import {
  baseCommandStepConfig,
  createCommandStepClient,
} from "./agent-task-pull-once-command-step.test-utils";

describe("agent task-pull once command steps", () => {
  it("executes a claimed terminal command locally, reports progress, and writes finish payload", async () => {
    const root = mkdtempSync(join(tmpdir(), "svton-agent-runtime-"));
    const client = createCommandStepClient();
    const progressUpdates: unknown[] = [];
    let finishPayload: AgentTaskPullFinishPayload | undefined;

    client.ack = async (_identity, _jobId, progress) => {
      client.calls.push("ack");
      progressUpdates.push(progress);
      return { acked: true, cancellation: null };
    };
    client.finish = async (_identity, _jobId, payload) => {
      client.calls.push(`finish:${payload.status}`);
      finishPayload = payload;
      return { accepted: true, finished: true };
    };
    client.claim = async () => {
      client.calls.push("claim");
      return {
        claimed: true,
        task: {
          available: true,
          jobId: "job-1",
          operationKey: "deployment.run",
          commandSteps: [
            {
              key: "deploy",
              label: "Deploy",
              command:
                "node -e \"const fs=require('fs'); fs.writeFileSync('runtime-proof.txt','ok'); process.stdout.write('terminal-ok')\"",
              required: true,
              timeoutSeconds: 5,
            },
          ],
        },
      };
    };

    try {
      const summary = await runAgentTaskPullOnce(
        { ...baseCommandStepConfig(true), cwd: root },
        { client },
      );

      expect(summary).toEqual({
        mode: "executed",
        jobId: "job-1",
        status: "completed",
        stepCount: 1,
      });
      expect(client.calls).toEqual([
        "contract",
        "claim",
        "ack",
        "ack",
        "finish:completed",
      ]);
      expect(progressUpdates).toEqual([
        {
          stepKey: "deploy",
          message: "Running Deploy",
          percent: 0,
        },
        {
          message: "Task command steps completed",
          percent: 100,
        },
      ]);
      expect(existsSync(join(root, "runtime-proof.txt"))).toBe(true);
      expect(readFileSync(join(root, "runtime-proof.txt"), "utf8")).toBe("ok");
      expect(finishPayload).toMatchObject({
        status: "completed",
        commandPlan: {
          mode: "cli_task_pull_once",
          dryRun: false,
          commandSteps: [
            {
              key: "deploy",
              label: "Deploy",
              required: true,
              timeoutSeconds: 5,
            },
          ],
        },
        logs: [
          {
            level: "info",
            message: "step deploy exited with 0",
            stdout: "terminal-ok",
            stderr: "",
          },
        ],
        result: {
          mode: "cli_task_pull_once",
          status: "completed",
          steps: [
            expect.objectContaining({
              key: "deploy",
              exitCode: 0,
              stdout: "terminal-ok",
              timedOut: false,
            }),
          ],
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finishes failed when a required step exits nonzero", async () => {
    const client = createCommandStepClient();

    const summary = await runAgentTaskPullOnce(baseCommandStepConfig(true), {
      client,
      executor: async (step) => ({
        key: step.key,
        command: step.command,
        exitCode: 2,
        durationMs: 5,
        stdout: "",
        stderr: "failed",
        timedOut: false,
      }),
    });

    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "failed",
      stepCount: 1,
      reason: "step_failed:deploy",
    });
    expect(client.calls).toEqual(["contract", "claim", "ack", "finish:failed"]);
  });
});
