import { runAgentTaskPullOnce } from "../utils/agent-task-pull-runner";
import {
  baseCommandStepConfig,
  createCommandStepClient,
} from "./agent-task-pull-once-command-step.test-utils";

describe("agent task-pull once command step guards", () => {
  it("finishes failed when a required step cwd escapes execution base", async () => {
    const client = createCommandStepClient();
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
              key: "deploy",
              command: 'node -e "process.stdout.write(`should-not-run`)"',
              cwd: "..",
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
      {
        ...baseCommandStepConfig(true),
        cwd: process.cwd(),
      },
      { client },
    );

    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "failed",
      stepCount: 1,
      reason: "step_failed:deploy",
    });
    expect(finishPayload).toMatchObject({
      status: "failed",
      error: "step_failed:deploy",
      logs: [
        {
          message: "step deploy exited with 1",
          stdout: "",
          stderr: expect.stringContaining("step_cwd_outside_execution_base"),
        },
      ],
    });
  });

  it("finishes failed when a command step cannot spawn", async () => {
    const client = createCommandStepClient();
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
              key: "deploy",
              command: 'node -e "process.stdout.write(`should-not-run`)"',
              cwd: "__svton_missing_spawn_dir__",
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
      { ...baseCommandStepConfig(true), cwd: process.cwd() },
      { client },
    );

    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "failed",
      stepCount: 1,
      reason: "step_failed:deploy",
    });
    expect(finishPayload).toMatchObject({
      status: "failed",
      error: "step_failed:deploy",
      logs: [
        {
          stderr: expect.stringContaining("spawn_error"),
        },
      ],
    });
  });
});
