import { runAgentTaskPullRunCommand } from "../commands/agent-task-pull";

describe("agent task-pull run command pid file", () => {
  it("installs and cleans up a pid file around task-pull run", async () => {
    const calls: string[] = [];
    const cleanup = jest.fn(() => calls.push("cleanupPid"));

    await runAgentTaskPullRunCommand(
      {
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        maxIterations: "1",
        pidFile: "/tmp/devpilot-agent.pid",
      },
      {
        createStopController: () => ({
          signal: new AbortController().signal,
          cleanup: () => calls.push("cleanupSignal"),
        }),
        installPidFile: (path) => {
          calls.push(`pid:${path}`);
          return cleanup;
        },
        runLoop: async () => {
          calls.push("runLoop");
          return {
            mode: "loop",
            iterations: 1,
            executed: 0,
            idle: 1,
            heartbeats: 0,
            stoppedReason: "idle_limit",
            runs: [],
          };
        },
        logSummary: jest.fn(),
      },
    );

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      "pid:/tmp/devpilot-agent.pid",
      "runLoop",
      "cleanupPid",
      "cleanupSignal",
    ]);
  });

  it("cleans up the stop controller when pid file install fails", async () => {
    const calls: string[] = [];
    const runLoop = jest.fn();
    const setExitCode = jest.fn();
    const logError = jest.fn();
    const logSummary = jest.fn();

    await runAgentTaskPullRunCommand(
      {
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        maxIterations: "1",
        pidFile: "/tmp/devpilot-agent.pid",
      },
      {
        createStopController: () => ({
          signal: new AbortController().signal,
          cleanup: () => calls.push("cleanupSignal"),
        }),
        installPidFile: (path) => {
          calls.push(`pid:${path}`);
          throw new Error("pid file is busy");
        },
        runLoop,
        logError,
        logSummary,
        setExitCode,
      },
    );

    expect(runLoop).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith("pid file is busy");
    expect(logSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "loop",
        iterations: 0,
        executed: 0,
        idle: 0,
        heartbeats: 0,
        stoppedReason: "startup_failed",
        startupError: "pid file is busy",
        runs: [],
        runnerId: expect.stringMatching(/^cli-.+-\d+$/),
      }),
    );
    expect(setExitCode).toHaveBeenCalledWith(1);
    expect(calls).toEqual(["pid:/tmp/devpilot-agent.pid", "cleanupSignal"]);
  });
});
