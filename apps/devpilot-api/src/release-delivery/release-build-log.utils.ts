import { redactRepositoryText } from "../repository-analysis/repository-analysis-redact.utils";

const MAX_LOG_LINES = 200;
const MAX_LOG_LINE_LENGTH = 1_000;
const MAX_PINNED_LINES = 50;

export function sanitizeBuildLogs(values: string[]): string[] {
  return normalizeBuildLogs(values).lines;
}

function normalizeBuildLogs(values: string[]) {
  const joined = values.join("\n");
  const source = redactRepositoryText(
    joined,
    [],
    Math.max(4_000, joined.length * 2),
  )
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.trimEnd());
  const pinned = source
    .map((line, index) => (isPinnedEvidence(line) ? index : -1))
    .filter((index) => index >= 0)
    .slice(-MAX_PINNED_LINES);
  const selected = new Set(pinned);
  for (let index = source.length - 1; index >= 0; index -= 1) {
    if (selected.size >= MAX_LOG_LINES) break;
    selected.add(index);
  }
  const indexes = [...selected].sort((left, right) => left - right);
  return {
    lines: indexes.map((index) => source[index].slice(0, MAX_LOG_LINE_LENGTH)),
    sourceLineCount: source.length,
    truncated:
      source.length > indexes.length ||
      indexes.some((index) => source[index].length > MAX_LOG_LINE_LENGTH),
  };
}

export function buildLogSummary(logs: string[]) {
  const safe = normalizeBuildLogs(logs);
  return {
    storage: "database",
    redacted: true,
    truncated: safe.truncated,
    sourceLineCount: safe.sourceLineCount,
    lineCount: safe.lines.length,
    lines: safe.lines,
  };
}

export function presentBuildLogSummary(value: unknown) {
  if (
    !isRecord(value) ||
    value.redacted !== true ||
    !Array.isArray(value.lines)
  ) {
    return null;
  }
  const source = value.lines.filter(
    (line): line is string => typeof line === "string",
  );
  const normalized = normalizeBuildLogs(source);
  return {
    storage: "database",
    redacted: true,
    truncated: value.truncated === true || normalized.truncated,
    sourceLineCount:
      Number.isInteger(value.sourceLineCount) &&
      Number(value.sourceLineCount) >= source.length
        ? Number(value.sourceLineCount)
        : normalized.sourceLineCount,
    lineCount: normalized.lines.length,
    lines: normalized.lines,
  };
}

export function buildLogReference(buildRunId: string) {
  return `build-log://${buildRunId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPinnedEvidence(line: string) {
  return /^\[[^\]]+\]\s+\$\s/.test(line) || /^result\s/i.test(line);
}
