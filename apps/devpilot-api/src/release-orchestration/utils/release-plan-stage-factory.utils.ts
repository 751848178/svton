/**
 * 单服务阶段工厂（纯函数）：把一个 ReleaseServiceInput 翻译成阶段节点 + 依赖边 +
 * 副作用/风险摘要。由 release-plan-builder 跨服务编排调用。
 *
 * 低层节点/边构造见 release-plan-stage-helpers.utils。本文件只负责阶段编排。
 */
import type { ReleaseDependencyConditionType } from "../types/release-orchestration.types";
import type { ReleaseDependency, ReleaseServiceInput } from "./release-plan-builder.utils";
import {
  APP_DEPLOY_RISK,
  BACKFILL_RISK,
  BOOTSTRAP_RISK,
  SCHEMA_MIGRATION_RISK,
  edge,
  makeStage,
  type StageCtx,
} from "./release-plan-stage-helpers.utils";
import { redactCommandSecrets } from "./release-credential-injection.utils";

// F383 P0-A：阶段命令在落库前就地脱敏——把承载秘密的 -e KEY=value 改写为
// $DEVPILOT_<KEY> 占位引用，使 configSnapshot / configHash 只反映占位结构，
// 永不出现明文秘密。真实值在执行边界由 ReleaseCredentialResolverService 解析。
function safeCommand(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  return redactCommandSecrets(raw).redactedCommand;
}

export interface ServiceStageResult {
  stages: Array<ReturnType<typeof makeStage>>;
  dependencies: ReleaseDependency[];
  sideEffects: string[];
  approvalRequired: Array<{ stageKey: string; reason: string }>;
}

export function buildServiceStages(svc: ReleaseServiceInput): ServiceStageResult {
  const stages: ServiceStageResult["stages"] = [];
  const dependencies: ReleaseDependency[] = [];
  const sideEffects: string[] = [];
  const approvalRequired: ServiceStageResult["approvalRequired"] = [];
  const ctx: StageCtx = {
    applicationId: svc.applicationId,
    applicationServiceId: svc.applicationServiceId,
    environmentId: svc.environmentId,
    serverId: svc.serverId ?? null,
  };
  let prevKey: string | null = null;
  // 紧邻上一阶段是否为可选 backfill；决定其出向边用 completed 还是 succeeded。
  let prevKeyWasOptionalBackfill = false;

  if (svc.preStartCheckCommand) {
    const key = `precheck:${svc.applicationServiceId}`;
    stages.push(
      makeStage({
        key,
        name: `配置校验 - ${svc.serviceName}`,
        type: "precheck",
        executorKind: "server_command",
        required: true,
        risk: "low",
        ctx,
        config: { command: safeCommand(svc.preStartCheckCommand), ...(svc.workingDirectory ? { workingDirectory: svc.workingDirectory } : {}) },
      }),
    );
    prevKey = key;
    prevKeyWasOptionalBackfill = false;
  }

  if (svc.migrationCommand) {
    const key = `schema_migration:${svc.applicationServiceId}`;
    stages.push(
      makeStage({
        key,
        name: `数据库结构迁移 - ${svc.serviceName}`,
        type: "schema_migration",
        executorKind: "server_command",
        required: true,
        risk: SCHEMA_MIGRATION_RISK,
        ctx,
        config: { command: safeCommand(svc.migrationCommand), concurrencyKey: `db:${svc.environmentId}`, ...(svc.workingDirectory ? { workingDirectory: svc.workingDirectory } : {}) },
      }),
    );
    if (prevKey) dependencies.push(edge(key, prevKey, "succeeded", true));
    prevKey = key;
    prevKeyWasOptionalBackfill = false;
    sideEffects.push(`${key}: 修改数据库结构（不可自动回滚）`);
    approvalRequired.push({ stageKey: key, reason: "数据库结构迁移为高风险" });
  }

  if (svc.initializationCommand) {
    const key = `bootstrap:${svc.applicationServiceId}`;
    stages.push(
      makeStage({
        key,
        name: `生产 bootstrap - ${svc.serviceName}`,
        type: "bootstrap",
        executorKind: "server_command",
        required: true,
        risk: BOOTSTRAP_RISK,
        ctx,
        config: {
          command: safeCommand(svc.initializationCommand), ...(svc.workingDirectory ? { workingDirectory: svc.workingDirectory } : {}),
          runPolicy: "once_per_environment_command",
          concurrencyKey: `bootstrap:${svc.applicationServiceId}:${svc.environmentId}`,
        },
      }),
    );
    if (prevKey) dependencies.push(edge(key, prevKey, "succeeded", true));
    prevKey = key;
    prevKeyWasOptionalBackfill = false;
    sideEffects.push(`${key}: 创建/更新生产初始化数据`);
    approvalRequired.push({ stageKey: key, reason: "生产 bootstrap 修改数据" });
  }

  if (svc.backfillCommand) {
    const key = `data_backfill:${svc.applicationServiceId}`;
    const isRequired = svc.backfillRequired === true;
    stages.push(
      makeStage({
        key,
        name: `历史数据回填 - ${svc.serviceName}`,
        type: "data_backfill",
        executorKind: "server_command",
        required: isRequired,
        risk: BACKFILL_RISK,
        ctx,
        config: { command: safeCommand(svc.backfillCommand), concurrencyKey: `db:${svc.environmentId}`, ...(svc.workingDirectory ? { workingDirectory: svc.workingDirectory } : {}) },
      }),
    );
    const cond: ReleaseDependencyConditionType = isRequired ? "succeeded" : "completed";
    if (prevKey) dependencies.push(edge(key, prevKey, cond, !isRequired));
    prevKey = key;
    // 标记：紧邻上一阶段是可选 backfill → 其出向 deploy 边改用 completed（允许跳过）。
    prevKeyWasOptionalBackfill = !isRequired;
    sideEffects.push(`${key}: 批量更新历史数据`);
    approvalRequired.push({ stageKey: key, reason: "历史数据回填高风险" });
  }

  if (svc.deployCommand) {
    const key = `application_deploy:${svc.applicationServiceId}`;
    // 可选 backfill 紧邻时，deploy 入边用 completed（允许 backfill 跳过后继续）。
    const incomingCond: ReleaseDependencyConditionType = prevKeyWasOptionalBackfill
      ? "completed"
      : "succeeded";
    const deployConfig: Record<string, unknown> = {
      deployCommand: svc.deployCommand,
      targetType: "server",
      releaseApplicationOnly: true,
      concurrencyKey: `service:${svc.environmentId}:${svc.applicationServiceId}`,
    };
    // VCS 透传：branch/commitSha/gitRepo 注入 deploy 配置快照（供 DeploymentRun 适配器读取）。
    if (svc.branch) deployConfig.branch = svc.branch;
    if (svc.commitSha) deployConfig.commitSha = svc.commitSha;
    if (svc.gitRepo) deployConfig.gitRepo = svc.gitRepo;
    stages.push(
      makeStage({
        key,
        name: `应用部署 - ${svc.serviceName}`,
        type: "application_deploy",
        executorKind: "deployment_run",
        required: true,
        risk: APP_DEPLOY_RISK,
        ctx,
        config: deployConfig,
      }),
    );
    if (prevKey)
      dependencies.push(edge(key, prevKey, incomingCond, prevKeyWasOptionalBackfill));
    prevKey = key;
    // 部署边已按可选 backfill 决策完毕，重置标记避免后续 health_check 继承。
    prevKeyWasOptionalBackfill = false;
    sideEffects.push(`${key}: 重启应用进程`);
    approvalRequired.push({ stageKey: key, reason: "应用部署为正式变更" });

    if (svc.healthCheckUrl) {
      const hkey = `health_check:${svc.applicationServiceId}`;
      stages.push(
        makeStage({
          key: hkey,
          name: `就绪检查 - ${svc.serviceName}`,
          type: "health_check",
          executorKind: "server_command",
          required: true,
          risk: "low",
          ctx,
          config: {
            healthCheckUrl: safeCommand(svc.healthCheckUrl),
            concurrencyKey: `service:${svc.environmentId}:${svc.applicationServiceId}`,
          },
        }),
      );
      dependencies.push(edge(hkey, key, "succeeded", true));
      sideEffects.push(`${hkey}: 验证应用健康（HTTP/命令探针）`);
    }
  }

  return { stages, dependencies, sideEffects, approvalRequired };
}

// 重新导出低层助手，便于现有引用（release-plan-builder）保持导入路径稳定。
export { makeStage, edge } from "./release-plan-stage-helpers.utils";
