import { ConfigService } from "@nestjs/config";
import { join } from "node:path";

export function releaseStagingProviderConfig(scope: string) {
  const values: Record<string, unknown> = {
    RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts"),
    RELEASE_STAGING_DEPLOYMENT_ROOT: join(scope, "deployments"),
    RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: 5_000,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

export function releaseStagingProviderComponent() {
  return {
    key: "service-1",
    name: "api",
    workingDirectory: ".",
    buildCommand: "true",
    artifactOutputs: ["dist"],
    buildEnvironment: {},
  };
}
