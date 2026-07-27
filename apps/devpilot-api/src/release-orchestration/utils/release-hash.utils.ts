/**
 * 稳定哈希计算：planHash / configHash / idempotencyKey / inputHash。
 * 输入先 JSON 规范化（key 排序），保证跨进程稳定。
 */
import { createHash } from "node:crypto";

// 递归排序对象的 key，输出稳定 JSON 串
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export function stableHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

// 发布计划输入快照哈希（环境+服务+命令配置+依赖图）
export function computePlanHash(snapshot: unknown): string {
  return stableHash({ v: 1, snapshot });
}

// 单阶段配置哈希
export function computeStageConfigHash(config: unknown): string {
  return stableHash({ v: 1, config });
}

// 幂等键：planId + stageKey + configHash
export function computeIdempotencyKey(
  releasePlanId: string,
  stageKey: string,
  configHash: string,
): string {
  return stableHash({ releasePlanId, stageKey, configHash });
}

// 审批绑定的输入哈希：plan + stage + environment + 输入快照
export function computeApprovalInputHash(input: {
  releasePlanId: string;
  stageKey: string;
  environmentId: string;
  configHash: string;
}): string {
  return stableHash({
    releasePlanId: input.releasePlanId,
    stageKey: input.stageKey,
    environmentId: input.environmentId,
    configHash: input.configHash,
  });
}
