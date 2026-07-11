import { runAgentTaskPullLoop } from "../utils/agent-task-pull-loop-runner";
import {
  baseLoopConfig,
  createLoopClient,
} from "./agent-task-pull-loop.test-utils";

describe("agent task-pull loop execution options", () => {
  it("uses configured ack renewal interval during loop execution", async () => {
    const client = createLoopClient(["task"]);
    const summary = await runAgentTaskPullLoop(
      { ...baseLoopConfig({ maxIterations: 1 }), ackRenewalIntervalMs: 1 },
      {
        executor: async (step) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return {
            key: step.key,
            command: step.command,
            exitCode: 0,
            durationMs: 5,
            stdout: "ok",
            stderr: "",
            timedOut: false,
          };
        },
        client,
      },
    );

    expect(summary.executed).toBe(1);
    expect(
      client.calls.filter((call) => call === "ack").length,
    ).toBeGreaterThan(2);
  });

  it("passes force-kill grace into loop command execution", async () => {
    const client = createLoopClient(["task"]);
    let forceKillGraceMs: number | undefined;

    const summary = await runAgentTaskPullLoop(
      { ...baseLoopConfig({ maxIterations: 1 }), forceKillGraceMs: 42 },
      {
        client,
        executor: async (step, options) => {
          forceKillGraceMs = options.forceKillGraceMs;
          return {
            key: step.key,
            command: step.command,
            exitCode: 0,
            durationMs: 1,
            stdout: "ok",
            stderr: "",
            timedOut: false,
          };
        },
      },
    );

    expect(summary.executed).toBe(1);
    expect(forceKillGraceMs).toBe(42);
  });
});
