import { runAgentTaskPullRunCommand } from "../commands/agent-task-pull";

describe("agent task-pull run command", () => {
  it("sets a nonzero exit code when the run loop stops on a failure reason", async () => {
    const controller = new AbortController();
    const cleanup = jest.fn();
    const logSummary = jest.fn();
    const setExitCode = jest.fn();

    await runAgentTaskPullRunCommand(
      {
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        maxIterations: "1",
      },
      {
        createStopController: () => ({
          signal: controller.signal,
          cleanup,
        }),
        runLoop: async (_config, deps) => {
          expect(deps?.signal).toBe(controller.signal);
          expect(_config.execute).toBe(true);
          expect(_config.maxIterations).toBe(1);
          return {
            mode: "loop",
            iterations: 1,
            executed: 1,
            idle: 0,
            heartbeats: 0,
            stoppedReason: "finish_writeback_failed",
            finishWritebackError: "finish_writeback_not_finished",
            runs: [],
          };
        },
        logSummary,
        setExitCode,
      },
    );

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(setExitCode).toHaveBeenCalledWith(1);
    expect(logSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        stoppedReason: "finish_writeback_failed",
      }),
    );
  });

  it("keeps a successful exit code when the run loop stops normally", async () => {
    const logSummary = jest.fn();
    const setExitCode = jest.fn();

    await runAgentTaskPullRunCommand(
      {
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        runner: "runner-1",
        idleLimit: "1",
      },
      {
        createStopController: () => ({
          signal: new AbortController().signal,
          cleanup: jest.fn(),
        }),
        runLoop: async () => ({
          mode: "loop",
          iterations: 1,
          executed: 0,
          idle: 1,
          heartbeats: 0,
          stoppedReason: "idle_limit",
          runs: [],
        }),
        logSummary,
        setExitCode,
      },
    );

    expect(setExitCode).not.toHaveBeenCalled();
    expect(logSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        runnerId: "runner-1",
        stoppedReason: "idle_limit",
      }),
    );
  });

  it("sets a nonzero exit code when the run loop reports a poll failure", async () => {
    const setExitCode = jest.fn();

    await runAgentTaskPullRunCommand(
      {
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        maxIterations: "1",
      },
      {
        createStopController: () => ({
          signal: new AbortController().signal,
          cleanup: jest.fn(),
        }),
        runLoop: async () => ({
          mode: "loop",
          iterations: 0,
          executed: 0,
          idle: 0,
          heartbeats: 0,
          stoppedReason: "poll_failed",
          pollError: "contract unavailable",
          runs: [],
        }),
        logSummary: jest.fn(),
        setExitCode,
      },
    );

    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});
