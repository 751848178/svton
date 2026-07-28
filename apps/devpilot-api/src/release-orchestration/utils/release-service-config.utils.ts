/**
 * 服务发布配置读取（F383 Slice 8a + 第三轮 P0-1）：把 ApplicationService.deployConfig
 * JSON 映射为 ReleaseServiceInput 需要的阶段命令字段，以及该服务声明的跨服务发布依赖边。
 *
 * 纯函数——不读 DB。控制器在 release-plan.controller 内已通过
 * ApplicationService 查询拿到了 deployConfig，本助手只负责 JSON → 字段。
 *
 * 字段名对齐 F382 `resolveDeploymentConfig`
 * （apps/devpilot-api/src/deployment/deployment-config-resolution.utils.ts），
 * backfillCommand 不是 DeploymentConfig 标准字段，额外从 deployConfig JSON 顶层
 * 读取以保持向后兼容（F382 部分服务在 deployConfig 内自行扩展）。
 *
 * 跨服务发布依赖（P0-1）：依赖定义源 = deployConfig.releaseDependencies 数组
 * （平台受控、持久化、可审计，由 application-service 写入 API 落库）。每条边只声明
 * 「下游（toServiceId / toStageType）+ 上游阶段类型（fromStageType）+ 条件/必需」，
 * 上游服务（fromServiceId）隐式为该 deployConfig 所属的 ApplicationService——
 * 避免一个服务声明跨到自己的对端，杜绝客户端伪造 fromServiceId。
 */
import type {
  ReleaseDependencyConditionType,
  ReleaseStageType,
} from "../types/release-orchestration.types";
import {
  RELEASE_DEPENDENCY_CONDITION_TYPES,
  RELEASE_STAGE_TYPES,
} from "../types/release-orchestration.types";

export interface ServiceDeployConfigCommands {
  preStartCheckCommand?: string;
  migrationCommand?: string;
  initializationCommand?: string;
  deployCommand?: string;
  healthCheckUrl?: string;
  backfillCommand?: string;
}

// deployConfig.releaseDependencies 数组里的一条声明边（从下游视角看自己依赖谁，
// 故只填下游 = toServiceId/toStageType，fromServiceId 由所属服务填充）。
export interface DeclaredServiceDependencyEdge {
  toServiceId: string;
  fromStageType: ReleaseStageType;
  toStageType: ReleaseStageType;
  conditionType: ReleaseDependencyConditionType;
  required?: boolean;
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

const STAGE_TYPE_SET = new Set<string>(RELEASE_STAGE_TYPES);
const CONDITION_TYPE_SET = new Set<string>(RELEASE_DEPENDENCY_CONDITION_TYPES);

// 读取单个声明边（畸形/字段非法 → 返回 undefined，跳过该条；调用方做计数断言）。
function readDeclaredEdge(
  raw: unknown,
): DeclaredServiceDependencyEdge | undefined {
  const rec = asRecord(raw);
  if (!rec) return undefined;
  const toServiceId = readString(rec.toServiceId);
  const fromStageType = readString(rec.fromStageType);
  const toStageType = readString(rec.toStageType);
  const conditionType = readString(rec.conditionType);
  if (!toServiceId || !fromStageType || !toStageType || !conditionType) {
    return undefined;
  }
  if (
    !STAGE_TYPE_SET.has(fromStageType) ||
    !STAGE_TYPE_SET.has(toStageType) ||
    !CONDITION_TYPE_SET.has(conditionType)
  ) {
    return undefined;
  }
  const required =
    typeof rec.required === "boolean" ? rec.required : true;
  return {
    toServiceId,
    fromStageType: fromStageType as ReleaseStageType,
    toStageType: toStageType as ReleaseStageType,
    conditionType: conditionType as ReleaseDependencyConditionType,
    required,
  };
}

// 读取该服务声明的所有跨服务发布依赖边（出向）。从 deployConfig.releaseDependencies
// 数组读取（顶层 + deployment 子层，与命令字段同源），规范化后返回。
// 畸形条目被静默跳过（platform 受控数据；非法声明不阻断发布，但不进 DAG）。
export function readServiceReleaseDependencies(
  deployConfig: unknown,
): DeclaredServiceDependencyEdge[] {
  const top = asRecord(deployConfig);
  if (!top) return [];
  const arrays: unknown[] = [];
  const topArr = Array.isArray(top.releaseDependencies) ? top.releaseDependencies : null;
  if (topArr) arrays.push(...topArr);
  const deployment = asRecord(top.deployment);
  if (deployment && Array.isArray(deployment.releaseDependencies)) {
    arrays.push(...deployment.releaseDependencies);
  }
  const edges: DeclaredServiceDependencyEdge[] = [];
  const seen = new Set<string>();
  for (const raw of arrays) {
    const edge = readDeclaredEdge(raw);
    if (!edge) continue;
    // 去重：同一 (toServiceId, fromStageType, toStageType, conditionType) 只留一条。
    const key = `${edge.toServiceId}|${edge.fromStageType}|${edge.toStageType}|${edge.conditionType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(edge);
  }
  return edges;
}
