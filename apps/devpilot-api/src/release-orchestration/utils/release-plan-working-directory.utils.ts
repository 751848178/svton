import type { ReleaseServiceInput } from "./release-plan-builder.utils";

export function withWorkingDirectory(
  service: ReleaseServiceInput,
  config: Record<string, unknown>,
): Record<string, unknown> {
  return service.workingDirectory
    ? { ...config, workingDirectory: service.workingDirectory }
    : config;
}
