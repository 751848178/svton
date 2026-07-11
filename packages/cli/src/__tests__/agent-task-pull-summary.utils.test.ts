import { buildAgentTaskPullExecutedRunSummary } from "../utils/agent-task-pull-summary.utils";

describe("agent task-pull summary utils", () => {
  it("preserves execution and finish writeback metadata", () => {
    expect(
      buildAgentTaskPullExecutedRunSummary({
        jobId: "job-1",
        status: "cancelled",
        stepCount: 2,
        error: "operator_stop",
        finishSummary: {
          finishAccepted: true,
          finishFinished: false,
          finishReason: "claimed_job_not_found_or_lock_mismatch",
        },
      }),
    ).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "cancelled",
      stepCount: 2,
      reason: "operator_stop",
      finishAccepted: true,
      finishFinished: false,
      finishReason: "claimed_job_not_found_or_lock_mismatch",
    });
  });
});
