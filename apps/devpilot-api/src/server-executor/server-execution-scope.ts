/**
 * 统一的 ServerExecution 作用域读取器（F383 P0-1）。
 *
 * 背景：release stage 适配器把项目/环境作用域写在 metadata.sourceMetadata.* 下，
 * 而历史上有三处各自实现的 reader（matcher 读顶层、audit scope 读多层回退），
 * 导致项目级/环境级命令策略模板永远命不中。本文件收敛为唯一 reader，回退顺序与
 * 已被验证的 readServerExecutionJobAuditScope 一致：
 *   1. 标准顶层 metadata.projectId / environmentId（新数据契约）
 *   2. 旧数据 metadata.sourceMetadata.projectId / environmentId（向后兼容）
 * 返回 null 表示无作用域（仅命中 team-global 模板）。
 */
import { isRecord, readOptionalString } from "./server-executor-json.utils";

export interface ExecutionScope {
  projectId: string | null;
  environmentId: string | null;
}

/**
 * 从 ServerExecution 的 metadata 里读取项目/环境作用域。
 * 顶层优先（新契约），其次 sourceMetadata（旧 release-stage 适配器数据）。
 */
export function readExecutionScopeFromMetadata(metadata: unknown): ExecutionScope {
  const top = isRecord(metadata) ? metadata : {};
  const sourceMetadata = isRecord(top.sourceMetadata) ? top.sourceMetadata : {};
  return {
    projectId:
      readScopeString(top.projectId) ??
      readScopeString(sourceMetadata.projectId) ??
      null,
    environmentId:
      readScopeString(top.environmentId) ??
      readScopeString(sourceMetadata.environmentId) ??
      null,
  };
}

// 读取并 trim 作用域字符串：空白串视为无作用域（与原 matcher 行为一致），
// 避免 "  proj-1  " 这类脏数据无法命中 DB 行。
function readScopeString(value: unknown): string | null {
  const s = readOptionalString(value);
  return s ? s.trim() : null;
}
