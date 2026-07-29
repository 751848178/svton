/**
 * Pure deployment command-step builders, warning collectors, and validation
 * helpers. Extracted from `DeploymentService` to begin the god-service split.
 * All functions are pure.
 */

import { ServerCommandStep } from "../server-executor";
import {
  buildEnvCleanupStep,
  buildEnvWriteStep,
} from "./deployment-env-injection.utils";
import { buildDeploymentLifecycleSteps } from "./deployment-lifecycle-step-builders.utils";
import {
  plannedInitializationDecision,
  type DeploymentInitializationDecision,
} from "./deployment-initialization.types";

export type DeploymentConfig = {
  targetType: string;
  workingDirectory?: string;
  buildCommand?: string;
  preStartCheckCommand?: string;
  migrationCommand?: string;
  initializationCommand?: string;
  deployCommand?: string;
  rollbackCommand?: string;
  healthCheckUrl?: string;
};

export function safeGitCommitSha(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^[a-fA-F0-9]{7,64}$/.test(trimmed) ? trimmed : undefined;
}

export function safePositiveInt(
  value: unknown,
  fallback: number,
  max: number,
): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(1, Math.min(Math.floor(numberValue), max));
}

export function buildCommandSteps(
  deployment: DeploymentConfig,
  gitRepo?: string,
  branch?: string,
  envVars?: Record<string, string>,
  initialization: DeploymentInitializationDecision = plannedInitializationDecision(
    deployment.initializationCommand,
  ),
  options?: { releaseApplicationOnly?: boolean },
): ServerCommandStep[] {
  const base: ServerCommandStep[] = [
    {
      key: "checkout",
      label: "拉取代码",
      // 禁止硬编码 main/master：分支必须由调用方解析（项目配置 source.branch 或显式传入）。
      // 分支缺失时 checkout 步骤命令为空且 required=false，由 collectWarnings 产出明确告警，
      // 而不是静默切到 main。
      command: gitRepo && branch
        ? `git fetch --all --prune && git checkout ${branch} && git pull`
        : "",
      cwd: deployment.workingDirectory || "",
      required: Boolean(gitRepo && branch),
      risk: "low",
      timeoutSeconds: 120,
      phase: "checkout",
      runPolicy: "every_deploy",
      failurePolicy: "block",
      decision: "execute",
    },
    {
      key: "build",
      label: "构建",
      command: deployment.buildCommand || "",
      cwd: deployment.workingDirectory || "",
      required: Boolean(deployment.buildCommand),
      risk: "medium",
      timeoutSeconds: 600,
      phase: "build",
      runPolicy: "every_deploy",
      failurePolicy: "block",
      decision: "execute",
    },
  ];

  if (envVars && Object.keys(envVars).length > 0) {
    base.push({
      ...buildEnvWriteStep(deployment.workingDirectory, envVars),
      phase: "environment",
      runPolicy: "every_deploy",
      failurePolicy: "block",
      decision: "execute",
    });
  }

  base.push(...buildDeploymentLifecycleSteps(deployment, initialization, options));
  base.push(
    {
      key: "deploy",
      label: "启动或更新服务",
      command: deployment.deployCommand || "",
      cwd: deployment.workingDirectory || "",
      required: true,
      risk: "medium",
      timeoutSeconds: 600,
      phase: "deploy",
      runPolicy: "every_deploy",
      failurePolicy: "block",
      decision: "execute",
    },
    {
      key: "health_check",
      label: "启动后健康检查",
      // 服务容器刚启动时进程尚未就绪，单次 curl 会立即失败（连接拒绝）。
      // 用 BusyBox 兼容的重试循环：在 timeoutSeconds 窗口内反复探测直到 2xx。
      command: deployment.healthCheckUrl
        ? `for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS ${deployment.healthCheckUrl} && exit 0; sleep 2; done; exit 1`
        : "",
      cwd: "",
      required: Boolean(deployment.healthCheckUrl),
      risk: "low",
      timeoutSeconds: 60,
      phase: "health_check",
      runPolicy: "every_deploy",
      failurePolicy: "block",
      decision: "execute",
    },
  );

  if (envVars && Object.keys(envVars).length > 0) {
    base.push({
      ...buildEnvCleanupStep(deployment.workingDirectory),
      phase: "cleanup",
      runPolicy: "every_deploy",
      failurePolicy: "best_effort",
      decision: "execute",
    });
  }

  return base;
}

export function buildRollbackCommandSteps(
  deployment: DeploymentConfig,
  gitRepo?: string,
  commitSha?: string | null,
  envVars?: Record<string, string>,
): ServerCommandStep[] {
  const safeCommitSha = safeGitCommitSha(commitSha);
  const deployCommand =
    deployment.rollbackCommand || deployment.deployCommand || "";
  const base: ServerCommandStep[] = [
    {
      key: "checkout_rollback",
      label: "切换到回滚版本",
      command:
        gitRepo && safeCommitSha
          ? `git fetch --all --prune && git checkout ${safeCommitSha}`
          : "",
      cwd: deployment.workingDirectory || "",
      required: Boolean(gitRepo && safeCommitSha),
      risk: "low",
      timeoutSeconds: 120,
    },
    {
      key: "build_rollback",
      label: "构建回滚版本",
      command: deployment.buildCommand || "",
      cwd: deployment.workingDirectory || "",
      required: Boolean(deployment.buildCommand),
      risk: "medium",
      timeoutSeconds: 600,
    },
  ];

  if (envVars && Object.keys(envVars).length > 0) {
    base.push(buildEnvWriteStep(deployment.workingDirectory, envVars));
  }

  base.push(
    {
      key: "deploy_rollback",
      label: deployment.rollbackCommand ? "执行回滚命令" : "重新部署回滚版本",
      command: deployCommand,
      cwd: deployment.workingDirectory || "",
      required: true,
      risk: "high",
      timeoutSeconds: 600,
    },
    {
      key: "health_check",
      label: "回滚后健康检查",
      command: deployment.healthCheckUrl
        ? `curl -fsS ${deployment.healthCheckUrl}`
        : "",
      cwd: "",
      required: Boolean(deployment.healthCheckUrl),
      risk: "low",
      timeoutSeconds: 30,
    },
  );

  if (envVars && Object.keys(envVars).length > 0) {
    base.push(buildEnvCleanupStep(deployment.workingDirectory));
  }

  return base;
}

export function buildSmokeCheckCommandSteps(
  healthCheckUrl: string,
): ServerCommandStep[] {
  return [
    {
      key: "deployment_smoke_check",
      label: "部署 Smoke 检查",
      command: `curl -fsS ${healthCheckUrl}`,
      cwd: "",
      required: true,
      risk: "low",
      timeoutSeconds: 30,
    },
  ];
}

export function collectWarnings(
  deployment: DeploymentConfig,
  gitRepo?: string,
  branch?: string,
  initialization?: DeploymentInitializationDecision,
): string[] {
  const warnings: string[] = [];
  if (!gitRepo) warnings.push("未配置 Git 仓库，无法生成代码拉取步骤");
  if (gitRepo && !branch) warnings.push("未配置发布分支（既无显式分支也无项目配置 source.branch），代码拉取步骤将被跳过");
  if (!deployment.workingDirectory) warnings.push("未配置工作目录");
  if (!deployment.deployCommand) warnings.push("未配置部署命令");
  if (!deployment.healthCheckUrl) warnings.push("未配置健康检查地址");
  if (initialization?.status === "blocked_in_progress") {
    warnings.push(
      `一次性初始化正由部署 ${initialization.ownerDeploymentRunId || "unknown"} 执行`,
    );
  }
  if (initialization?.status === "blocked_missing_scope") {
    warnings.push(
      initialization.skipReason || "一次性初始化缺少应用服务或环境范围",
    );
  }
  return warnings;
}

export function collectRollbackWarnings(
  deployment: DeploymentConfig,
  gitRepo?: string,
  commitSha?: string | null,
): string[] {
  const warnings: string[] = [];
  if (!gitRepo)
    warnings.push("未配置 Git 仓库，无法生成回滚代码 checkout 步骤。");
  if (gitRepo && !safeGitCommitSha(commitSha))
    warnings.push(
      "历史部署记录缺少有效的 Git commit SHA，无法生成 checkout 回滚步骤。",
    );
  if (!deployment.workingDirectory) warnings.push("未配置工作目录");
  if (!deployment.deployCommand && !deployment.rollbackCommand)
    warnings.push("未配置部署/回滚命令");
  if (!deployment.healthCheckUrl) warnings.push("未配置健康检查地址");
  return warnings;
}
