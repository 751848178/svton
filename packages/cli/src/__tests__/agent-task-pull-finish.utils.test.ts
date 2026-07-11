import {
  buildAgentTaskPullFinishPayload,
  readAgentTaskPullFinishWritebackSummary,
} from "../utils/agent-task-pull-finish.utils";
import type { AgentTaskPullTask } from "../utils/agent-task-pull-types";

describe("agent task-pull finish utils", () => {
  it("preserves the finish payload contract", () => {
    const task: AgentTaskPullTask = {
      available: true,
      jobId: "job-1",
      operationKey: "deployment.run",
      lifecycle: { mode: "claim_ack_finish" },
      commandSteps: [
        {
          key: "deploy",
          label: "Deploy",
          command: "echo deploy",
          required: true,
          timeoutSeconds: 30,
        },
      ],
    };

    expect(
      buildAgentTaskPullFinishPayload(task, {
        status: "failed",
        logs: [{ level: "error", message: "step deploy exited with 2" }],
        result: { mode: "cli_task_pull_once", status: "failed" },
        error: "step_failed:deploy",
      }),
    ).toEqual({
      status: "failed",
      commandPlan: {
        mode: "cli_task_pull_once",
        lifecycleMode: "claim_ack_finish",
        dryRun: false,
        commandSteps: [
          {
            key: "deploy",
            label: "Deploy",
            required: true,
            timeoutSeconds: 30,
          },
        ],
      },
      logs: [{ level: "error", message: "step deploy exited with 2" }],
      result: { mode: "cli_task_pull_once", status: "failed" },
      error: "step_failed:deploy",
    });
  });

  it("summarizes rejected finish writeback responses", () => {
    expect(
      readAgentTaskPullFinishWritebackSummary({
        accepted: true,
        finished: false,
        reason: "claimed_job_not_found_or_lock_mismatch",
      }),
    ).toEqual({
      finishAccepted: true,
      finishFinished: false,
      finishReason: "claimed_job_not_found_or_lock_mismatch",
    });

    expect(
      readAgentTaskPullFinishWritebackSummary({
        accepted: true,
        finished: true,
        reason: "server_agent_job_finished",
      }),
    ).toEqual({});
  });
});
