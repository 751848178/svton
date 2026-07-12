import {
  emitAgentTaskPullLoopSummaryResult,
  emitAgentTaskPullOnceSummaryResult,
} from "../commands/agent-task-pull-command-result.service";
import type { AgentTaskPullLoopSummary } from "../utils/agent-task-pull-loop-summary.types";
import type { AgentTaskPullRunSummary } from "../utils/agent-task-pull-runner";

describe("agent task-pull command result emission", () => {
  it("emits once summaries and sets nonzero exit code for failures", () => {
    const logSummary = jest.fn();
    const setExitCode = jest.fn();
    const summary = buildOnceSummary("failed");

    emitAgentTaskPullOnceSummaryResult(summary, { logSummary, setExitCode });

    expect(logSummary).toHaveBeenCalledWith(summary);
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  it("emits once summaries without exit code changes for success", () => {
    const logSummary = jest.fn();
    const setExitCode = jest.fn();
    const summary = buildOnceSummary("completed");

    emitAgentTaskPullOnceSummaryResult(summary, { logSummary, setExitCode });

    expect(logSummary).toHaveBeenCalledWith(summary);
    expect(setExitCode).not.toHaveBeenCalled();
  });

  it("emits loop summaries and sets nonzero exit code for failure stops", () => {
    const logSummary = jest.fn();
    const setExitCode = jest.fn();
    const summary = {
      ...buildLoopSummary(),
      stoppedReason: "poll_failed",
      pollError: "network unavailable",
    } satisfies AgentTaskPullLoopSummary;

    emitAgentTaskPullLoopSummaryResult(summary, { logSummary, setExitCode });

    expect(logSummary).toHaveBeenCalledWith(summary);
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  it("emits loop summaries without exit code changes for normal stops", () => {
    const logSummary = jest.fn();
    const setExitCode = jest.fn();
    const summary = buildLoopSummary();

    emitAgentTaskPullLoopSummaryResult(summary, { logSummary, setExitCode });

    expect(logSummary).toHaveBeenCalledWith(summary);
    expect(setExitCode).not.toHaveBeenCalled();
  });
});

function buildOnceSummary(
  status: "completed" | "failed",
): AgentTaskPullRunSummary {
  return {
    mode: "executed",
    jobId: "job-1",
    status,
    stepCount: 1,
  };
}

function buildLoopSummary(): AgentTaskPullLoopSummary {
  return {
    mode: "loop",
    iterations: 1,
    executed: 1,
    idle: 0,
    heartbeats: 0,
    stoppedReason: "max_iterations",
    runs: [],
  };
}
