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
});
