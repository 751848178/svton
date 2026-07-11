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
});
