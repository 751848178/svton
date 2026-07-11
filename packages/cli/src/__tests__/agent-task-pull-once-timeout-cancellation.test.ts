import { executeAgentTaskPullStep } from "../utils/agent-task-pull-executor";
import { runAgentTaskPullOnce } from "../utils/agent-task-pull-runner";
import {
  baseTimeoutCancellationConfig,
  createTimeoutCancellationClient,
} from "./agent-task-pull-once-timeout-cancellation.test-utils";

describe("agent task-pull once timeout and cancellation", () => {
  it("finishes cancelled when final ack returns cancellation", async () => {
    const client = createTimeoutCancellationClient();
    let ackCount = 0;
    client.ack = async () => {
      client.calls.push("ack");
      ackCount += 1;
      return ackCount > 1
        ? {
            acked: true,
            cancellation: { shouldStop: true, reason: "operator_stop" },
          }
        : { acked: true, cancellation: null };
    };

    const summary = await runAgentTaskPullOnce(
      baseTimeoutCancellationConfig(true),
      {
        client,
        executor: async (step) => ({
          key: step.key,
          command: step.command,
          exitCode: 0,
          durationMs: 5,
          stdout: "ok",
          stderr: "",
          timedOut: false,
        }),
      },
    );

    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "cancelled",
      stepCount: 1,
      reason: "operator_stop",
    });
    expect(client.calls).toEqual([
      "contract",
      "claim",
      "ack",
      "ack",
      "finish:cancelled",
    ]);
  });

  it("finishes cancelled when the stop signal cancels a running step", async () => {
    const client = createTimeoutCancellationClient();
    const controller = new AbortController();

    const summary = await runAgentTaskPullOnce(
      baseTimeoutCancellationConfig(true),
      {
        client,
        signal: controller.signal,
        executor: async (step, options) => {
          expect(options.signal).not.toBe(controller.signal);
          expect(options.signal?.aborted).toBe(false);
          controller.abort();
          expect(options.signal?.aborted).toBe(true);
          return {
            key: step.key,
            command: step.command,
            exitCode: null,
            durationMs: 5,
            stdout: "",
            stderr: "",
            timedOut: false,
            cancelled: true,
          };
        },
      },
    );

    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "cancelled",
      stepCount: 1,
      reason: "signal",
    });
    expect(client.calls).toEqual([
      "contract",
      "claim",
      "ack",
      "finish:cancelled",
    ]);
  });

  it("terminates the child process when its signal is aborted", async () => {
    const controller = new AbortController();
    const running = executeAgentTaskPullStep(
      {
        key: "sleep",
        command: 'node -e "setInterval(() => {}, 1000)"',
      },
      { signal: controller.signal },
    );

    setTimeout(() => controller.abort(), 10);
    const result = await running;

    expect(result).toMatchObject({
      key: "sleep",
      exitCode: null,
      timedOut: false,
      cancelled: true,
    });
  });
});
