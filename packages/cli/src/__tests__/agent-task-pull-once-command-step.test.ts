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
});
