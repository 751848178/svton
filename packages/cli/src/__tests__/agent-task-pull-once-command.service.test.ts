import { runAgentTaskPullOnceCommand } from "../commands/agent-task-pull";

describe("agent task-pull once command", () => {
  it("wires the stop signal into the once command runner and cleans up", async () => {
    const controller = new AbortController();
    const cleanup = jest.fn();
    const logSummary = jest.fn();
    const setExitCode = jest.fn();

    await runAgentTaskPullOnceCommand(
      {
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        execute: true,
        ackRenewalIntervalMs: "25",
        forceKillGraceMs: "75",
      },
      {
        createStopController: () => ({
          signal: controller.signal,
          cleanup,
        }),
        runOnce: async (_config, deps) => {
          expect(deps?.signal).toBe(controller.signal);
          expect(deps?.ackRenewalIntervalMs).toBe(25);
          expect(_config.forceKillGraceMs).toBe(75);
          return {
            mode: "executed",
            jobId: "job-1",
            status: "cancelled",
            stepCount: 1,
            reason: "signal",
          };
        },
        logSummary,
        setExitCode,
      },
    );

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(logSummary).toHaveBeenCalledWith({
      mode: "executed",
      jobId: "job-1",
      status: "cancelled",
      stepCount: 1,
      reason: "signal",
    });
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  it("keeps a successful exit code when the once command completes", async () => {
    const logSummary = jest.fn();
    const setExitCode = jest.fn();

    await runAgentTaskPullOnceCommand(
      {
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        execute: true,
      },
      {
        createStopController: () => ({
          signal: new AbortController().signal,
          cleanup: jest.fn(),
        }),
        runOnce: async () => ({
          mode: "executed",
          jobId: "job-1",
          status: "completed",
          stepCount: 1,
        }),
        logSummary,
        setExitCode,
      },
    );

    expect(setExitCode).not.toHaveBeenCalled();
    expect(logSummary).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("sets a nonzero exit code when once finish writeback is not completed", async () => {
    const setExitCode = jest.fn();

    await runAgentTaskPullOnceCommand(
      {
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        execute: true,
      },
      {
        createStopController: () => ({
          signal: new AbortController().signal,
          cleanup: jest.fn(),
        }),
        runOnce: async () => ({
          mode: "executed",
          jobId: "job-1",
          status: "completed",
          stepCount: 1,
          finishFinished: false,
          finishReason: "lost_lock",
        }),
        logSummary: jest.fn(),
        setExitCode,
      },
    );

    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});
