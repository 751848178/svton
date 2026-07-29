/**
 * 服务发布配置读取（F383 Slice 8a + 第三轮 P0-1）：把 ApplicationService.deployConfig
 * JSON 映射为 ReleaseServiceInput 需要的阶段命令字段。
 *
 * 纯函数——不读 DB。控制器在 release-plan.controller 内已通过 ApplicationService
 * 查询拿到了 deployConfig，本助手只负责 JSON → 字段。
 *
 * 字段名对齐 F382 resolveDeploymentConfig
 * （apps/devpilot-api/src/deployment/deployment-config-resolution.utils.ts），
 * backfillCommand 不是 DeploymentConfig 标准字段，额外从 deployConfig JSON 顶层
 * 读取以保持向后兼容（F382 部分服务在 deployConfig 内自行扩展）。
 *
 * 跨服务依赖边的解析（releaseDependencies 数组）见 release-service-deps.utils.ts
 * （Item 1 fail-closed，独立职责）。
 */
export interface ServiceDeployConfigCommands {
  preStartCheckCommand?: string;
  migrationCommand?: string;
  initializationCommand?: string;
  deployCommand?: string;
  healthCheckUrl?: string;
  backfillCommand?: string;
}

// ApplicationService.deployConfig 是 Json? 类型；运行时可能是对象/数组/原始值/null。
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// F382 deployConfig 形状：
//   { deployment: { preStartCheckCommand, migrationCommand, ... }, stackProfile: {...} }
// 但也可能扁平化（旧种子或手工）。本助手从两层（顶层 + deployment 子对象）读取，
// 镜像 resolveDeploymentConfig 的 [next, serviceConfig, deployment] 优先级。
export function readServiceDeployConfig(
  deployConfig: unknown,
): ServiceDeployConfigCommands {
  const top = asRecord(deployConfig);
  if (!top) return {};
  const deployment = asRecord(top.deployment);
  const stackProfile = asRecord(top.stackProfile);

  const pick = (key: string): string | undefined => {
    const direct = readString(top[key]);
    if (direct) return direct;
    if (deployment) {
      const d = readString(deployment[key]);
      if (d) return d;
    }
    if (key === "deployCommand" && stackProfile) {
      const sp = readString(stackProfile.deployCommand);
      if (sp) return sp;
    }
    return undefined;
  };

  return {
    preStartCheckCommand: pick("preStartCheckCommand"),
    migrationCommand: pick("migrationCommand"),
    initializationCommand: pick("initializationCommand"),
    deployCommand: pick("deployCommand"),
    healthCheckUrl: pick("healthCheckUrl"),
    backfillCommand: pick("backfillCommand"),
  };
}
