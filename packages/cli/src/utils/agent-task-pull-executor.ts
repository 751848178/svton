import spawn from "cross-spawn";
import { resolveAgentTaskPullStepCwd } from "./agent-task-pull-cwd.utils";
import { appendAgentTaskPullOutput } from "./agent-task-pull-output.utils";
import {
  buildAgentTaskPullCancelledResult,
  buildAgentTaskPullInvalidCwdResult,
  buildAgentTaskPullSpawnErrorResult,
} from "./agent-task-pull-result.utils";
import type { AgentTaskPullExecutor } from "./agent-task-pull-types";

const DEFAULT_FORCE_KILL_GRACE_MS = 5_000;

export const executeAgentTaskPullStep: AgentTaskPullExecutor = (
  step,
  options,
) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    if (options.signal?.aborted) {
      resolve(buildAgentTaskPullCancelledResult(step, startedAt));
      return;
    }
    const cwd = resolveAgentTaskPullStepCwd(step.cwd, options.cwd);
    if (!cwd.ok) {
      resolve(buildAgentTaskPullInvalidCwdResult(step, startedAt, cwd));
      return;
    }
    const child = spawn(step.command, [], {
      cwd: cwd.cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      detached: process.platform !== "win32",
    });
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let cancelled = false;
    let forceKillTimer: NodeJS.Timeout | undefined;
    let terminationRequested = false;
    const terminate = () => {
      if (terminationRequested) return;
      terminationRequested = true;
      forceKillTimer = requestTermination(child, options.forceKillGraceMs);
    };
    const abort = () => {
      cancelled = true;
      terminate();
    };
    const timeoutMs =
      step.timeoutSeconds && step.timeoutSeconds > 0
        ? step.timeoutSeconds * 1000
        : undefined;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          terminate();
        }, timeoutMs)
      : undefined;

    options.signal?.addEventListener("abort", abort, { once: true });
    child.stdout?.on("data", (chunk: Buffer) => {
      const output = appendAgentTaskPullOutput(stdout, chunk.toString());
      stdout = output.value;
      stdoutTruncated ||= output.truncated;
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const output = appendAgentTaskPullOutput(stderr, chunk.toString());
      stderr = output.value;
      stderrTruncated ||= output.truncated;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      cleanup(timer, forceKillTimer, options.signal, abort);
      resolve(buildAgentTaskPullSpawnErrorResult(step, startedAt, error));
    });
    child.on("close", (exitCode) => {
      cleanup(timer, forceKillTimer, options.signal, abort);
      resolve({
        key: step.key,
        command: step.command,
        exitCode,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
        ...(stdoutTruncated ? { stdoutTruncated } : {}),
        ...(stderrTruncated ? { stderrTruncated } : {}),
        timedOut,
        cancelled,
      });
    });
  });

function requestTermination(
  child: { pid?: number; kill(signal: NodeJS.Signals): boolean },
  forceKillGraceMs: number | undefined,
): NodeJS.Timeout {
  signalChild(child, "SIGTERM");
  const timer = setTimeout(() => {
    signalChild(child, "SIGKILL");
  }, forceKillGraceMs ?? DEFAULT_FORCE_KILL_GRACE_MS);
  timer.unref?.();
  return timer;
}

function signalChild(
  child: { pid?: number; kill(signal: NodeJS.Signals): boolean },
  signal: NodeJS.Signals,
) {
  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through to the child handle for platforms/shells without a group.
    }
  }
  child.kill(signal);
}

function cleanup(
  timer: NodeJS.Timeout | undefined,
  forceKillTimer: NodeJS.Timeout | undefined,
  signal: AbortSignal | undefined,
  abort: () => void,
) {
  if (timer) clearTimeout(timer);
  if (forceKillTimer) clearTimeout(forceKillTimer);
  signal?.removeEventListener("abort", abort);
}
