import { runAgentTaskPullLoop } from "../utils/agent-task-pull-loop-runner";
import {
  baseLoopConfig,
  createLoopClient,
} from "./agent-task-pull-loop.test-utils";

describe("agent task-pull loop stop boundary", () => {
  it("stops after the configured idle limit", async () => {
    const client = createLoopClient(["task", "idle", "idle"]);

    const summary = await runAgentTaskPullLoop(
      baseLoopConfig({ maxIterations: 10, idleLimit: 2 }),
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
      iterations: 3,
      executed: 1,
      idle: 2,
      stoppedReason: "idle_limit",
    });
  });

  it("stops immediately when task-pull is disabled", async () => {
    const client = createLoopClient(["disabled", "task"]);

    const summary = await runAgentTaskPullLoop(
      baseLoopConfig({ maxIterations: 10, idleLimit: 10 }),
      { client },
    );

    expect(summary).toMatchObject({
      iterations: 1,
      executed: 0,
      idle: 1,
      stoppedReason: "task_pull_disabled",
      runs: [{ mode: "no_task", reason: "task_pull_disabled" }],
    });
    expect(client.calls).toEqual(["contract", "claim"]);
  });

  it("stops before polling when the stop signal is already aborted", async () => {
    const client = createLoopClient(["task"]);
    const controller = new AbortController();
    controller.abort();

    const summary = await runAgentTaskPullLoop(
      baseLoopConfig({ maxIterations: 1 }),
      {
        client,
        signal: controller.signal,
      },
    );

    expect(summary).toMatchObject({
      iterations: 0,
      executed: 0,
      idle: 0,
      heartbeats: 0,
      stoppedReason: "signal",
    });
    expect(client.calls).toEqual([]);
  });

  it("stops at the next polling boundary after the stop signal is aborted", async () => {
    const client = createLoopClient(["idle", "idle"]);
    const controller = new AbortController();
    const sleepSignals: Array<AbortSignal | undefined> = [];

    const summary = await runAgentTaskPullLoop(
      { ...baseLoopConfig({ maxIterations: 10 }), intervalMs: 1 },
      {
        client,
        signal: controller.signal,
        sleep: async (_ms, signal) => {
          sleepSignals.push(signal);
          controller.abort();
        },
      },
    );

    expect(summary).toMatchObject({
      iterations: 1,
      executed: 0,
      idle: 1,
      stoppedReason: "signal",
    });
    expect(client.calls).toEqual(["contract", "claim"]);
    expect(sleepSignals).toEqual([controller.signal]);
  });

  it("wakes the default interval delay when the stop signal is aborted", async () => {
    const client = createLoopClient(["idle", "idle"]);
    const controller = new AbortController();

    const running = runAgentTaskPullLoop(
      { ...baseLoopConfig({ maxIterations: 10 }), intervalMs: 10_000 },
      {
        client,
        signal: controller.signal,
      },
    );

    setTimeout(() => controller.abort(), 5);
    const summary = await Promise.race([
      running,
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 200),
      ),
    ]);

    expect(summary).toMatchObject({
      iterations: 1,
      executed: 0,
      idle: 1,
      stoppedReason: "signal",
    });
    expect(client.calls).toEqual(["contract", "claim"]);
  });
});
