import { UnprocessableEntityException } from "@nestjs/common";
import { redactRepositoryText } from "../repository-analysis/repository-analysis-redact.utils";
import {
  readArtifactOutputs,
  readBuildEnvironment,
} from "./release-build-artifact-contract.utils";
import type { ReleaseBuildComponent } from "./release-build.types";

interface ApplicationRecord {
  id: string;
  name: string;
  repoPath: string | null;
  services: Array<{
    id: string;
    releaseComponentKey?: string | null;
    name: string;
    deployConfig: unknown;
  }>;
}

export function buildComponents(
  applications: ApplicationRecord[],
): ReleaseBuildComponent[] {
  const components: ReleaseBuildComponent[] = [];
  const contracts = new Map<string, string>();
  for (const application of applications) {
    for (const service of application.services) {
      const config = record(service.deployConfig);
      const command = text(config.buildCommand);
      if (!command) continue;
      if (redactRepositoryText(command) !== command) {
        throw new UnprocessableEntityException(
          "构建命令包含凭据或秘密字面量，已拒绝执行",
        );
      }
      const workingDirectory =
        text(config.workingDirectory) || application.repoPath || ".";
      const key = service.releaseComponentKey ?? service.id;
      const component = {
        key,
        name: `${application.name || application.id}/${service.name}`,
        workingDirectory,
        buildCommand: command,
        artifactOutputs: readArtifactOutputs(config.artifactPaths),
        buildEnvironment: readBuildEnvironment(config.buildEnvironment),
      };
      const contract = JSON.stringify({
        workingDirectory: component.workingDirectory,
        buildCommand: component.buildCommand,
        artifactOutputs: component.artifactOutputs,
        buildEnvironment: component.buildEnvironment,
      });
      const prior = contracts.get(key);
      if (prior && prior !== contract) {
        throw new UnprocessableEntityException(
          `组件 ${key} 在双基线中的构建契约不一致`,
        );
      }
      if (!prior) {
        contracts.set(key, contract);
        components.push(component);
      }
    }
  }
  return components.sort((left, right) => left.key.localeCompare(right.key));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
