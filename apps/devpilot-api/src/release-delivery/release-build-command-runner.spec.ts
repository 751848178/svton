import { runControlledBuildCommand } from "./release-build-command-runner";

describe("runControlledBuildCommand", () => {
  const env = {
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    CI: "true",
  };

  it("uses only the explicitly supplied child environment", async () => {
    const result = await runControlledBuildCommand({
      command: "node -e \"console.log(process.env.DATABASE_URL || 'absent')\"",
      cwd: process.cwd(),
      env,
      timeoutMs: 2_000,
      cancelGraceMs: 50,
    });
    expect(result).toMatchObject({ kind: "completed", exitCode: 0 });
    expect(result.stdout.trim()).toBe("absent");
  });

  it("returns a distinct timeout outcome", async () => {
    const result = await runControlledBuildCommand({
      command: 'node -e "setTimeout(() => {}, 30000)"',
      cwd: process.cwd(),
      env,
      timeoutMs: 30,
      cancelGraceMs: 30,
    });
    expect(result.kind).toBe("timed_out");
  });

  it("cancels the detached process group", async () => {
    const controller = new AbortController();
    const kill = jest.spyOn(process, "kill");
    const running = runControlledBuildCommand({
      command: 'node -e "setTimeout(() => {}, 30000)"',
      cwd: process.cwd(),
      env,
      timeoutMs: 5_000,
      cancelGraceMs: 30,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 30);
    const result = await running;
    expect(result.kind).toBe("canceled");
    expect(
      kill.mock.calls.some(
        ([pid, signal]) =>
          typeof pid === "number" && pid < 0 && signal === "SIGTERM",
      ),
    ).toBe(true);
    kill.mockRestore();
  });
});
