import { runAgentTaskPullOnce } from "../utils/agent-task-pull-runner";
import {
  baseTimeoutCancellationConfig,
  createTimeoutCancellationClient,
} from "./agent-task-pull-once-timeout-cancellation.test-utils";

describe("agent task-pull once timeout semantics", () => {
  it("finishes timeout with a timeout-specific reason and log", async () => {
    const client = createTimeoutCancellationClient();
    let finishPayload: unknown;
    client.finish = async (_identity, _jobId, payload) => {
      client.calls.push(`finish:${payload.status}`);
      finishPayload = payload;
      return { finished: true };
    };

    const summary = await runAgentTaskPullOnce(
      baseTimeoutCancellationConfig(true),
      {
        client,
        executor: async (step) => ({
          key: step.key,
          command: step.command,
          exitCode: null,
          durationMs: 50,
          stdout: "",
          stderr: "",
          timedOut: true,
        }),
      },
    );

    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "failed",
      stepCount: 1,
      reason: "step_timeout:deploy",
    });
    expect(finishPayload).toMatchObject({
      status: "failed",
      error: "step_timeout:deploy",
      logs: [{ message: "step deploy timed out" }],
      result: { status: "failed", steps: [{ timedOut: true }] },
    });
  });

  it("continues after an optional command step timeout", async () => {
    const client = createTimeoutCancellationClient();
    let finishPayload: unknown;
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
              key: "warmup",
              command: "echo warmup",
              required: false,
            },
            {
              key: "deploy",
              command: "echo deploy",
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

    const summary = await runAgentTaskPullOnce(
      baseTimeoutCancellationConfig(true),
      {
        client,
        executor: async (step) => ({
          key: step.key,
          command: step.command,
          exitCode: step.key === "warmup" ? null : 0,
          durationMs: 5,
          stdout: "",
          stderr: "",
          timedOut: step.key === "warmup",
        }),
      },
    );

    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "completed",
      stepCount: 2,
    });
    expect(finishPayload).toMatchObject({
      status: "completed",
      logs: [
        { message: "step warmup timed out" },
        { message: "step deploy exited with 0" },
      ],
      result: { status: "completed" },
    });
    expect(
      (finishPayload as { result: { steps: Array<{ timedOut: boolean }> } })
        .result.steps,
    ).toEqual([
      expect.objectContaining({ timedOut: true }),
      expect.objectContaining({ timedOut: false }),
    ]);
  });
});
