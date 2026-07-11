import { runAgentTaskPullLoop } from "../utils/agent-task-pull-loop-runner";
import {
  baseLoopConfig,
  createLoopClient,
} from "./agent-task-pull-loop.test-utils";

describe("agent task-pull loop", () => {
  it("runs multiple task-pull iterations until max iterations", async () => {
    const client = createLoopClient(["task", "task"]);

    const summary = await runAgentTaskPullLoop(
      baseLoopConfig({ maxIterations: 2 }),
      {
        client,
        executor: async (step) => ({
          key: step.key,
          command: step.command,
          exitCode: 0,
          durationMs: 1,
          stdout: "ok",
          stderr: "",
          timedOut: false,
        }),
        sleep: async () => undefined,
      },
    );

    expect(summary).toMatchObject({
      mode: "loop",
      iterations: 2,
      executed: 2,
      idle: 0,
      stoppedReason: "max_iterations",
    });
    expect(client.calls).toEqual([
      "contract",
      "claim",
      "ack",
      "ack",
      "finish:completed",
      "contract",
      "claim",
      "ack",
      "ack",
      "finish:completed",
    ]);
  });

  it("stops when finish writeback is not completed", async () => {
    const client = createLoopClient(["task", "task"]);
    client.finish = async (_identity, _jobId, payload) => {
      client.calls.push(`finish:${payload.status}`);
      return {
        accepted: true,
        finished: false,
        reason: "claimed_job_not_found_or_lock_mismatch",
      };
    };

    const summary = await runAgentTaskPullLoop(
      baseLoopConfig({ maxIterations: 2 }),
      {
        client,
        executor: async (step) => ({
          key: step.key,
          command: step.command,
          exitCode: 0,
          durationMs: 1,
          stdout: "ok",
          stderr: "",
          timedOut: false,
        }),
        sleep: async () => undefined,
      },
    );

    expect(summary).toMatchObject({
      mode: "loop",
      iterations: 1,
      executed: 1,
      idle: 0,
      stoppedReason: "finish_writeback_failed",
      finishWritebackError: "claimed_job_not_found_or_lock_mismatch",
      runs: [
        {
          finishAccepted: true,
          finishFinished: false,
          finishReason: "claimed_job_not_found_or_lock_mismatch",
        },
      ],
    });
    expect(client.calls).toEqual([
      "contract",
      "claim",
      "ack",
      "ack",
      "finish:completed",
    ]);
  });

  it("returns a structured summary when polling throws", async () => {
    const client = createLoopClient(["task"]);
    client.contract = async () => {
      client.calls.push("contract");
      throw new Error("contract unavailable");
    };

    const summary = await runAgentTaskPullLoop(
      baseLoopConfig({ maxIterations: 1 }),
      {
        client,
        sleep: async () => undefined,
      },
    );

    expect(summary).toMatchObject({
      mode: "loop",
      iterations: 0,
      executed: 0,
      idle: 0,
      stoppedReason: "poll_failed",
      pollError: "contract unavailable",
      runs: [],
    });
    expect(client.calls).toEqual(["contract"]);
  });
});
