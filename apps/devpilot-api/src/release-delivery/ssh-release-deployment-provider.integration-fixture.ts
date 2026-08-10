import { ConfigService } from "@nestjs/config";
import { join } from "node:path";

export function sshIntegrationRuntimeConfig(scope: string, remoteRoot: string) {
  const values: Record<string, unknown> = {
    RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts"),
    RELEASE_DEPLOYMENT_SSH_HOST: process.env.F431_SSH_HOST || "127.0.0.1",
    RELEASE_DEPLOYMENT_SSH_PORT: Number(process.env.F431_SSH_PORT || 2225),
    RELEASE_DEPLOYMENT_SSH_USERNAME: process.env.F431_SSH_USERNAME || "deploy",
    RELEASE_DEPLOYMENT_SSH_PASSWORD:
      process.env.F431_SSH_PASSWORD || "devpilot-test",
    RELEASE_DEPLOYMENT_SSH_ROOT: remoteRoot,
    RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: 20_000,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

export function sshIntegrationCredentials() {
  return {
    host: process.env.F431_SSH_HOST || "127.0.0.1",
    port: Number(process.env.F431_SSH_PORT || 2225),
    username: process.env.F431_SSH_USERNAME || "deploy",
    password: process.env.F431_SSH_PASSWORD || "devpilot-test",
  };
}

export function sshIntegrationComponent() {
  return {
    key: "service-1",
    name: "api",
    workingDirectory: ".",
    buildCommand: "true",
    artifactOutputs: ["dist"],
    buildEnvironment: {},
  };
}
