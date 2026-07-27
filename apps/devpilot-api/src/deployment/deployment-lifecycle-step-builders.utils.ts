import type { ServerCommandStep } from "../server-executor";
import type { DeploymentConfig } from "./deployment-command-builders.utils";
import type { DeploymentInitializationDecision } from "./deployment-initialization.types";

function lifecycleStep(
  key: string,
  label: string,
  command: string | undefined,
  cwd: string | undefined,
  phase: ServerCommandStep["phase"],
  risk: ServerCommandStep["risk"],
  timeoutSeconds: number,
): ServerCommandStep | null {
  if (!command) return null;
  return {
    key,
    label,
    command,
    cwd: cwd || "",
    required: true,
    risk,
    timeoutSeconds,
    phase,
    runPolicy: "every_deploy",
    failurePolicy: "block",
    decision: "execute",
  };
}

function initializationStep(
  deployment: DeploymentConfig,
  decision: DeploymentInitializationDecision,
): ServerCommandStep | null {
  if (!deployment.initializationCommand) return null;
  const skipped = decision.status === "skipped_already_completed";
  return {
    key: "initialization",
    label: "一次性业务初始化",
    command: skipped ? "" : deployment.initializationCommand,
    cwd: deployment.workingDirectory || "",
    required: !skipped,
    risk: "medium",
    timeoutSeconds: 600,
    phase: "initialization",
    runPolicy: "once_per_environment_command",
    failurePolicy: "block",
    decision: skipped ? "skip" : "execute",
    skipReason: skipped
      ? decision.skipReason || "同一初始化命令已在当前环境成功执行"
      : undefined,
  };
}

export function buildDeploymentLifecycleSteps(
  deployment: DeploymentConfig,
  initialization: DeploymentInitializationDecision,
  options?: { releaseApplicationOnly?: boolean },
): ServerCommandStep[] {
  // 发布编排（F383）已把 precheck/migration/initialization 拆为独立阶段；
  // 此时内部部署运行不得重复执行它们。仅由 release 模块内部使用。
  if (options?.releaseApplicationOnly) {
    return [];
  }
  return [
    lifecycleStep(
      "pre_start_check",
      "启动前校验",
      deployment.preStartCheckCommand,
      deployment.workingDirectory,
      "pre_start_check",
      "low",
      120,
    ),
    lifecycleStep(
      "migration",
      "数据库迁移",
      deployment.migrationCommand,
      deployment.workingDirectory,
      "migration",
      "medium",
      600,
    ),
    initializationStep(deployment, initialization),
  ].filter((step): step is ServerCommandStep => step !== null);
}
