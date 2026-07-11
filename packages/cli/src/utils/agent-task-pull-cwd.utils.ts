import path from "node:path";

export type AgentTaskPullCwdResolution =
  | { ok: true; cwd: string }
  | {
      ok: false;
      baseCwd: string;
      requestedCwd: string;
      reason: string;
    };

export function resolveAgentTaskPullStepCwd(
  stepCwd: string | undefined,
  baseCwd: string | undefined,
  processCwd = process.cwd(),
): AgentTaskPullCwdResolution {
  const resolvedBase = path.resolve(processCwd, baseCwd || ".");
  const requestedCwd = stepCwd
    ? path.isAbsolute(stepCwd)
      ? path.resolve(stepCwd)
      : path.resolve(resolvedBase, stepCwd)
    : resolvedBase;

  if (!isWithinPath(requestedCwd, resolvedBase)) {
    return {
      ok: false,
      baseCwd: resolvedBase,
      requestedCwd,
      reason: "step_cwd_outside_execution_base",
    };
  }

  return { ok: true, cwd: requestedCwd };
}

function isWithinPath(target: string, base: string) {
  const relative = path.relative(base, target);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}
