import { prepareAgentTaskPullRunStartup } from "../commands/agent-task-pull-run-startup.service";

describe("prepareAgentTaskPullRunStartup", () => {
  it("allows the run loop without a pid file", () => {
    const result = prepareAgentTaskPullRunStartup({});

    expect(result.shouldRun).toBe(true);
    expect(result.cleanupPidFile()).toBeUndefined();
  });

  it("installs and returns pid-file cleanup", () => {
    const cleanup = jest.fn();
    const installPidFile = jest.fn(() => cleanup);

    const result = prepareAgentTaskPullRunStartup(
      { pidFile: "/tmp/devpilot-agent.pid" },
      { installPidFile },
    );

    expect(result.shouldRun).toBe(true);
    expect(installPidFile).toHaveBeenCalledWith("/tmp/devpilot-agent.pid");
    result.cleanupPidFile();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("reports startup failure and blocks the run loop", () => {
    const logError = jest.fn();
    const setExitCode = jest.fn();

    const result = prepareAgentTaskPullRunStartup(
      { pidFile: "/tmp/devpilot-agent.pid" },
      {
        installPidFile: () => {
          throw new Error("pid file is busy");
        },
        logError,
        setExitCode,
      },
    );

    expect(result.shouldRun).toBe(false);
    expect(result.startupError).toBe("pid file is busy");
    expect(result.cleanupPidFile()).toBeUndefined();
    expect(logError).toHaveBeenCalledWith("pid file is busy");
    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});
