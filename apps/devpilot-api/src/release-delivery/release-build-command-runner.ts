import { spawn } from "node:child_process";

export type ReleaseBuildCommandOutcome = {
  kind:
    | "completed"
    | "timed_out"
    | "canceled"
    | "output_limited"
    | "spawn_failed";
  exitCode: number;
  stdout: string;
  stderr: string;
};

export function runControlledBuildCommand(input: {
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  cancelGraceMs: number;
  signal?: AbortSignal;
  maxOutputBytes?: number;
}): Promise<ReleaseBuildCommandOutcome> {
  if (input.signal?.aborted) {
    return Promise.resolve(outcome("canceled", 1, [], []));
  }
  return new Promise((resolvePromise) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let terminalKind: ReleaseBuildCommandOutcome["kind"] | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    const child = spawn("/bin/sh", ["-c", input.command], {
      cwd: input.cwd,
      detached: true,
      env: input.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const terminate = (kind: ReleaseBuildCommandOutcome["kind"]) => {
      if (terminalKind) return;
      terminalKind = kind;
      killGroup(child.pid, "SIGTERM");
      killTimer = setTimeout(
        () => killGroup(child.pid, "SIGKILL"),
        input.cancelGraceMs,
      );
      killTimer.unref();
    };
    const collect = (target: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes <= (input.maxOutputBytes || 1024 * 1024))
        target.push(chunk);
      else terminate("output_limited");
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    const timeout = setTimeout(() => terminate("timed_out"), input.timeoutMs);
    timeout.unref();
    const cancel = () => terminate("canceled");
    input.signal?.addEventListener("abort", cancel, { once: true });
    child.once("error", (error) => {
      stderr.push(Buffer.from(error.message));
      terminalKind = terminalKind || "spawn_failed";
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      input.signal?.removeEventListener("abort", cancel);
      resolvePromise(
        outcome(
          terminalKind || "completed",
          typeof code === "number" ? code : 1,
          stdout,
          stderr,
        ),
      );
    });
  });
}

function killGroup(pid: number | undefined, signal: NodeJS.Signals) {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // The process group already exited.
    }
  }
}

function outcome(
  kind: ReleaseBuildCommandOutcome["kind"],
  exitCode: number,
  stdout: Buffer[],
  stderr: Buffer[],
): ReleaseBuildCommandOutcome {
  return {
    kind,
    exitCode,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
  };
}
