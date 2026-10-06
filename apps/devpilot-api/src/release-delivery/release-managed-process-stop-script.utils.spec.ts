import {
  buildReleaseProcessGroupRunningCheck,
  buildReleaseProcessGroupStopScript,
} from "./release-managed-process-stop-script.utils";

describe("buildReleaseProcessGroupStopScript", () => {
  it("treats zombie-only process groups as stopped", () => {
    const script = buildReleaseProcessGroupStopScript("pid");

    expect(script).toContain("release_process_group_is_running");
    expect(script).toContain("grep -Eqv '^[[:space:]]*[ZX]'");
    expect(script).not.toContain('kill -0 "-$pid" 2>/dev/null && exit 1');
  });

  it("rejects unsafe shell variable names", () => {
    expect(() => buildReleaseProcessGroupStopScript("pid; exit 0")).toThrow(
      "managed process PID variable is invalid",
    );
  });

  it("can embed the running check without sending signals", () => {
    const script = buildReleaseProcessGroupRunningCheck("workload_pid");

    expect(script).toContain('kill -0 "-$workload_pid"');
    expect(script).not.toContain("kill -TERM");
    expect(script).not.toContain("kill -KILL");
  });

  it("supports a function-safe failure path for legacy stop recovery", () => {
    const script = buildReleaseProcessGroupStopScript(
      "previous_pid",
      "return 1",
    );

    expect(script).toContain("return 1");
    expect(script).not.toContain("exit 1");
  });
});
