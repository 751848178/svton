import type { RepositoryAnalysisRun } from "@prisma/client";
import { secureRepositoryCommands } from "./repository-command-security.utils";
import { detectIntakeComponent } from "./repository-intake-detection.utils";
import type {
  DetectedService,
  RepositorySuggestionDraft,
} from "./repository-parser.types";
import {
  type ExistingRepositoryApplication,
  findRepositoryApplication,
  findRepositoryService,
} from "./repository-suggestion-match.utils";
import { repositoryWorkloadContract } from "./repository-workload-contract.utils";

export function buildRepositoryServiceDraft(
  detected: DetectedService,
  run: RepositoryAnalysisRun,
  repositoryUrl: string,
  environmentId: string | undefined,
  applications: ExistingRepositoryApplication[],
): RepositorySuggestionDraft {
  const application = findRepositoryApplication(applications, detected, repositoryUrl);
  const currentService = findRepositoryService(application, detected, environmentId);
  const secured = secureRepositoryCommands(detected.commands);
  const workload = repositoryWorkloadContract(detected, secured.commands);
  const deployConfig = compact({
    targetType: workload.targetType,
    workingDirectory: detected.path,
    buildCommand: secured.commands.build,
    artifactPaths: detected.artifacts,
    deployCommand: workload.deployCommand,
    workloadExecutionMode: workload.workloadExecutionMode,
    statusCommand: workload.statusCommand,
    failureCleanupCommand: workload.failureCleanupCommand,
    migrationCommand: secured.commands.migrate,
    initializationCommand: secured.commands.bootstrap,
    seedCommand: secured.commands.seed,
    backfillCommand: secured.commands.backfill,
    healthCheckPath: detected.healthChecks[0]?.path,
    healthCheckUrl: workload.healthCheckUrl,
    dockerfile: detected.container.dockerfile,
    dockerBuildContext: detected.container.buildContext,
    composeFiles: detected.container.composeFiles,
  });
  const proposedValue = {
    applicationId: application?.id,
    applicationName: application?.name || detected.name,
    applicationDescription: application ? undefined : `${detected.role} · 来自仓库解析`,
    repositoryUrl,
    defaultBranch: run.branch,
    repoPath: application ? application.repoPath || undefined : detected.path,
    environmentId,
    environmentKey: environmentId ? undefined : "production",
    serviceId: currentService?.id,
    serviceName: currentService?.name || detected.name,
    releaseComponentKey: detected.key,
    kind: workload.kind,
    runtime: detected.runtime,
    ports: detected.ports,
    deployConfig,
    metadata: {
      repositoryAnalysis: {
        runId: run.id,
        commitSha: run.commitSha,
        role: detected.role,
        frameworks: detected.framework,
        environment: detected.environment,
        healthChecks: detected.healthChecks,
        artifacts: detected.artifacts,
        intakeContract: detectIntakeComponent(detected),
      },
    },
  };
  return {
    key: `application_service:${detected.key}`,
    kind: "application_service",
    confidence: detected.warnings.length ? "medium" : "high",
    conflict: Boolean(currentService && !same(currentService.deployConfig, deployConfig)),
    impact: `${application ? "关联" : "创建"}应用和环境服务，并写入构建、启动、端口与发布阶段建议。`,
    currentValue: currentService
      ? { applicationId: application?.id, serviceId: currentService.id, ...currentService }
      : application ? { applicationId: application.id, serviceId: null } : undefined,
    proposedValue: compact(proposedValue),
    evidence: detected.evidence,
    warnings: [...detected.warnings, ...secured.warnings],
  };
}

function compact<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}
