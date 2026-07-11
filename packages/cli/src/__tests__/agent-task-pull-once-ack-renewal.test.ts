import { runAgentTaskPullOnce } from "../utils/agent-task-pull-runner";
import {
  baseLifecycleConfig,
  createLifecycleClient,
} from "./agent-task-pull-once-lifecycle.test-utils";

describe("agent task-pull once ack renewal", () => {
  it("renews ack while a command step is running", async () => {
    const client = createLifecycleClient();
    const progressUpdates: unknown[] = [];
    client.ack = async (_identity, _jobId, progress) => {
      client.calls.push("ack");
      progressUpdates.push(progress);
      return { acked: true, cancellation: null };
    };

    const summary = await runAgentTaskPullOnce(baseLifecycleConfig(true), {
      client,
      ackRenewalIntervalMs: 5,
      executor: async (step) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return {
          key: step.key,
          command: step.command,
          exitCode: 0,
          durationMs: 25,
          stdout: "ok",
          stderr: "",
          timedOut: false,
        };
      },
    });

    const stepAcks = progressUpdates.filter(
      (progress) =>
        typeof progress === "object" &&
        progress !== null &&
        "stepKey" in progress,
    );
    expect(summary.status).toBe("completed");
    expect(stepAcks.length).toBeGreaterThan(1);
  });

  it("cancels a running step when ack renewal receives cancellation", async () => {
    const client = createLifecycleClient();
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

    const summary = await runAgentTaskPullOnce(baseLifecycleConfig(true), {
      client,
      ackRenewalIntervalMs: 5,
      executor: async (step, options) =>
        new Promise((resolve) => {
          options.signal?.addEventListener(
            "abort",
            () =>
              resolve({
                key: step.key,
                command: step.command,
                exitCode: null,
                durationMs: 5,
                stdout: "",
                stderr: "",
                timedOut: false,
                cancelled: true,
              }),
            { once: true },
          );
        }),
    });

    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "cancelled",
      stepCount: 1,
      reason: "operator_stop",
    });
    expect(client.calls).toContain("finish:cancelled");
  });
});
