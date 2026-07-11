import { runAgentTaskPullOnce } from "../utils/agent-task-pull-runner";
import {
  baseCommandStepConfig,
  createCommandStepClient,
} from "./agent-task-pull-once-command-step.test-utils";

describe("agent task-pull once command steps", () => {
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

  it("writes output truncation flags to finish logs and result", async () => {
    const client = createCommandStepClient();
    let finishPayload: unknown;
    client.finish = async (_identity, _jobId, payload) => {
      client.calls.push(`finish:${payload.status}`);
      finishPayload = payload;
      return { finished: true };
    };

    const summary = await runAgentTaskPullOnce(baseCommandStepConfig(true), {
      client,
      executor: async (step) => ({
        key: step.key,
        command: step.command,
        exitCode: 0,
        durationMs: 5,
        stdout: "tail",
        stderr: "error-tail",
        stdoutTruncated: true,
        stderrTruncated: true,
        timedOut: false,
      }),
    });

    expect(summary.status).toBe("completed");
    expect(finishPayload).toMatchObject({
      logs: [
        {
          stdout: "tail",
          stderr: "error-tail",
          stdoutTruncated: true,
          stderrTruncated: true,
        },
      ],
      result: {
        steps: [
          expect.objectContaining({
            stdoutTruncated: true,
            stderrTruncated: true,
          }),
        ],
      },
    });
  });

  it("skips command execution for a dry-run task", async () => {
    const client = createCommandStepClient();
    const executor = jest.fn();
    let finishPayload: unknown;
    client.claim = async () => {
      client.calls.push("claim");
      return {
        claimed: true,
        task: {
          available: true,
          jobId: "job-1",
          operationKey: "deployment.run",
          dryRun: true,
          commandSteps: [
            {
              key: "deploy",
              command: 'node -e "throw new Error(`should-not-run`)"',
              required: true,
            },
          ],
        },
      };
    };
    client.finish = async (_identity, _jobId, payload) => {
      client.calls.push(`finish:${payload.status}`);
      finishPayload = payload;
      return { finished: true };
    };

    const summary = await runAgentTaskPullOnce(baseCommandStepConfig(true), {
      client,
      executor,
    });

    expect(executor).not.toHaveBeenCalled();
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
      "finish:completed",
    ]);
    expect(finishPayload).toMatchObject({
      status: "completed",
      commandPlan: { dryRun: true },
      logs: [
        {
          message: "step deploy exited with 0",
          dryRunSkipped: true,
        },
      ],
      result: {
        steps: [
          expect.objectContaining({
            key: "deploy",
            exitCode: 0,
            dryRunSkipped: true,
          }),
        ],
      },
    });
  });
});
