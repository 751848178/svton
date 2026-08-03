import { redactRepositoryText } from "../repository-analysis/repository-analysis-redact.utils";

const MAX_LOG_LINES = 200;
const MAX_LOG_LINE_LENGTH = 1_000;

export function sanitizeBuildLogs(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(/\r?\n/))
    .filter(Boolean)
    .slice(-MAX_LOG_LINES)
    .map((line) => redactRepositoryText(line).slice(0, MAX_LOG_LINE_LENGTH));
}

export function buildLogSummary(logs: string[]) {
  const safe = sanitizeBuildLogs(logs);
  return {
    storage: "database",
    redacted: true,
    truncated: logs.length > safe.length,
    lineCount: safe.length,
    lines: safe,
  };
}

export function buildLogReference(buildRunId: string) {
  return `build-log://${buildRunId}`;
}
