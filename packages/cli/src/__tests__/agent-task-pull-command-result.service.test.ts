import {
  buildAgentTaskPullStartupFailureLoopSummary,
  emitAgentTaskPullLoopSummaryResult,
  emitAgentTaskPullOnceSummaryResult,
  withAgentTaskPullLoopRunnerId,
} from "../commands/agent-task-pull-command-result.service";
import type { AgentTaskPullLoopSummary } from "../utils/agent-task-pull-loop-summary.types";
import type { AgentTaskPullRunSummary } from "../utils/agent-task-pull-runner";

describe("agent task-pull command result service", () => {
  it("builds a startup failure loop summary with runner context", () => {
    expect(
      buildAgentTaskPullStartupFailureLoopSummary({
        startupError: "pid file is busy",
        runnerId: "runner-1",
      }),
    ).toEqual({
      mode: "loop",
      iterations: 0,
      executed: 0,
      idle: 0,
      heartbeats: 0,
      stoppedReason: "startup_failed",
      startupError: "pid file is busy",
      runnerId: "runner-1",
      runs: [],
    });
  });

  it("omits optional startup failure fields when they are absent", () => {
    expect(buildAgentTaskPullStartupFailureLoopSummary({})).toEqual({
      mode: "loop",
      iterations: 0,
      executed: 0,
      idle: 0,
      heartbeats: 0,
      stoppedReason: "startup_failed",
      runs: [],
    });
  });

  it("adds runner id to a loop summary when configured", () => {
    const summary = buildLoopSummary();

    expect(withAgentTaskPullLoopRunnerId(summary, "runner-1")).toEqual({
      ...summary,
      runnerId: "runner-1",
    });
  });

  it("returns the original loop summary when runner id is absent", () => {
    const summary = buildLoopSummary();

    expect(withAgentTaskPullLoopRunnerId(summary)).toBe(summary);
  });

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
