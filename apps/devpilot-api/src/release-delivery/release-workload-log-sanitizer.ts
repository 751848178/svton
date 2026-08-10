import { sanitizeBuildLogs } from "./release-build-log.utils";

export function sanitizeReleaseWorkloadLogs(
  logs: string[],
  environment: Record<string, string>,
) {
  let text = logs.join("\n");
  for (const value of Object.values(environment).filter(Boolean)) {
    text = text.replaceAll(value, "[REDACTED]");
  }
  return sanitizeBuildLogs([text]);
}
