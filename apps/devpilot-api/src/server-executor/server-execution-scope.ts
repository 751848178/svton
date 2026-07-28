/**
 * 统一的 ServerExecution 作用域读取器（F383 P0-1）。
 *
 * 背景：release stage 适配器把项目/环境作用域写在 metadata.sourceMetadata.* 下，
 * 而 server-executor 作业持久化层会把整个 metadata 再包一层 sourceMetadata（故线上
 * 实际形状是 metadata.sourceMetadata.sourceMetadata.projectId —— 双层嵌套）。历史
 * reader 只读一层，导致项目级/环境级命令策略模板永远命不中。本文件收敛为唯一 reader，
 * 回退顺序（每层都查 projectId/environmentId）：
 *   1. 标准顶层 metadata.projectId / environmentId（新数据契约）
 *   2. metadata.sourceMetadata.* （一层）
 *   3. metadata.sourceMetadata.sourceMetadata.* （持久化层二次包裹，线上真实形状）
 * 返回 null 表示无作用域（仅命中 team-global 模板）。
 *
 * 注意：本文件刻意自包含（不 import ./server-executor-json.utils），避免 Node10
 * 模块解析对 .utils.ts 文件名的怪异行为在跨文件引用时引发级联类型丢失。
 */
export interface ExecutionScope {
  projectId: string | null;
  environmentId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 从 ServerExecution 的 metadata 里读取项目/环境作用域。
 * 顶层优先；其次递归下钻 sourceMetadata（兼容持久化层的二次包裹）。
 */
export function readExecutionScopeFromMetadata(metadata: unknown): ExecutionScope {
  const top = isRecord(metadata) ? metadata : {};
  return {
    projectId: readScopeString(top.projectId) ?? scopeDeep(top, "projectId"),
    environmentId:
      readScopeString(top.environmentId) ?? scopeDeep(top, "environmentId"),
  };
}

// 沿 sourceMetadata 链下钻查找作用域字段（兼容一层与两层嵌套）。
// 线上持久化层会把 metadata 包成 { sourceMetadata: { ...original, sourceMetadata: {...} } }，
// 故最多下钻两层即可覆盖所有已知形状。
function scopeDeep(
  rec: Record<string, unknown>,
  field: "projectId" | "environmentId",
): string | null {
  const sm = isRecord(rec.sourceMetadata) ? rec.sourceMetadata : null;
  if (!sm) return null;
  const direct = readScopeString(sm[field]);
  if (direct) return direct;
  const inner = isRecord(sm.sourceMetadata) ? sm.sourceMetadata : null;
  return inner ? readScopeString(inner[field]) : null;
}

// 读取并 trim 作用域字符串：空白串视为无作用域（与原 matcher 行为一致），
// 避免 "  proj-1  " 这类脏数据无法命中 DB 行。
function readScopeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
