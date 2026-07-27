import type { ServerCommandStep } from "../server-executor.types";

const START_MARKER = /^__DEVPILOT_STEP_START__\|([^|]+)\|(\d+)$/;
const END_MARKER = /^__DEVPILOT_STEP_END__\|([^|]+)\|(-?\d+)\|(\d+)$/;

type StepTiming = {
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number;
};

export function extractSshLiveStepEvidence(
  stderr: string,
  steps: ServerCommandStep[],
) {
  const timings = new Map<string, StepTiming>();
  const cleanLines: string[] = [];

  for (const line of stderr.split(/\r?\n/)) {
    const start = line.match(START_MARKER);
    if (start) {
      timings.set(start[1], { startedAt: Number(start[2]) * 1000 });
      continue;
    }
    const end = line.match(END_MARKER);
    if (end) {
      timings.set(end[1], {
        ...timings.get(end[1]),
        exitCode: Number(end[2]),
        finishedAt: Number(end[3]) * 1000,
      });
      continue;
    }
    cleanLines.push(line);
  }

  return {
    stderr: cleanLines.join("\n").replace(/\n+$/, ""),
    stepResults: steps.map((step) => buildStepEvidence(step, timings)),
  };
}

function buildStepEvidence(
  step: ServerCommandStep,
  timings: Map<string, StepTiming>,
) {
  const key = step.key.replace(/[^a-zA-Z0-9_.:-]/g, "_");
  const timing = timings.get(key);
  const skipped = !step.command || Boolean(step.skipReason);
  const durationMs =
    timing?.startedAt && timing.finishedAt
      ? Math.max(0, timing.finishedAt - timing.startedAt)
      : undefined;

  return {
    key: step.key,
    label: step.label,
    phase: step.phase,
    runPolicy: step.runPolicy,
    failurePolicy: step.failurePolicy,
    decision: step.decision,
    skipReason: step.skipReason,
    status: skipped
      ? "skipped"
      : timing?.exitCode === 0
        ? "completed"
        : timing?.exitCode !== undefined
          ? "failed"
          : timing?.startedAt
            ? "failed"
            : "not_started",
    exitCode: timing?.exitCode,
    startedAt: timing?.startedAt
      ? new Date(timing.startedAt).toISOString()
      : undefined,
    finishedAt: timing?.finishedAt
      ? new Date(timing.finishedAt).toISOString()
      : undefined,
    durationMs,
  };
}
