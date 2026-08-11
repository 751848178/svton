import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

export type ReleaseBuildArgvOutcome = {
  kind: "completed" | "timed_out" | "canceled" | "output_limited" | "spawn_failed";
  exitCode: number;
  stdout: string;
  stderr: string;
  argvDigest: string;
  startedAt: string;
  finishedAt: string;
};

export function runReleaseBuildArgv(input: {
  executable: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  cancelGraceMs: number;
  signal?: AbortSignal;
  maxOutputBytes?: number;
}): Promise<ReleaseBuildArgvOutcome> {
  const startedAt = new Date().toISOString();
  const argvDigest = digest([input.executable, ...input.args]);
  if (input.signal?.aborted) {
    return Promise.resolve(outcome("canceled", 1, [], [], argvDigest, startedAt));
  }
  return new Promise((resolvePromise) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let terminal: ReleaseBuildArgvOutcome["kind"] | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    const child = spawn(input.executable, [...input.args], {
      cwd: input.cwd,
      detached: true,
      env: input.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    const terminate = (kind: ReleaseBuildArgvOutcome["kind"]) => {
      if (terminal) return;
      terminal = kind;
      killGroup(child.pid, "SIGTERM");
      killTimer = setTimeout(
        () => killGroup(child.pid, "SIGKILL"),
        input.cancelGraceMs,
      );
      killTimer.unref();
    };
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= (input.maxOutputBytes ?? 1024 * 1024)) target.push(chunk);
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
      terminal ||= "spawn_failed";
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      input.signal?.removeEventListener("abort", cancel);
      resolvePromise(outcome(
        terminal ?? "completed",
        typeof code === "number" ? code : 1,
        stdout,
        stderr,
        argvDigest,
        startedAt,
      ));
    });
  });
}

function outcome(
  kind: ReleaseBuildArgvOutcome["kind"],
  exitCode: number,
  stdout: Buffer[],
  stderr: Buffer[],
  argvDigest: string,
  startedAt: string,
): ReleaseBuildArgvOutcome {
  return {
    kind,
    exitCode,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
    argvDigest,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

function killGroup(pid: number | undefined, signal: NodeJS.Signals) {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try { process.kill(pid, signal); } catch { /* already exited */ }
  }
}

function digest(argv: readonly string[]) {
  return createHash("sha256").update(JSON.stringify(argv)).digest("hex");
}
