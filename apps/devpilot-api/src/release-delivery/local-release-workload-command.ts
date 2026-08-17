import { runReleaseBuildArgv } from "./release-build-argv-command-runner";
import type { ReleaseWorkloadCommandResult } from "./release-staging-workload.types";

export async function executeLocalReleaseWorkloadCommand(
  script: string,
  timeoutMs: number,
): Promise<ReleaseWorkloadCommandResult> {
  const result = await runReleaseBuildArgv({
    executable: "/bin/sh",
    args: ["-c", script],
    cwd: "/",
    env: {
      PATH: process.env.PATH,
      LANG: process.env.LANG || "C.UTF-8",
    },
    timeoutMs,
    cancelGraceMs: 1_000,
    maxOutputBytes: 512 * 1024,
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    timedOut: result.kind === "timed_out",
    cancelled: result.kind === "canceled",
  };
}
