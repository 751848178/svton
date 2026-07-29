/**
 * 发布分支来源解析（F383 §3）。
 *
 * 禁止任何生产逻辑或验证脚本硬编码 main/master。权威来源为
 * Project.config.source.branch。本模块为纯函数，preview/create/ReleasePlan/
 * DeploymentRun/实际 Git 命令共用同一分支快照。
 *
 * 规则：
 *  - 显式分支缺失 → 继承项目配置分支（resolvedFromProject=true）。
 *  - 显式分支与项目配置分支不一致 → 返回 warning（不静默，提示用户）。
 *  - 项目配置分支也缺失 → resolvedBranch=undefined，由调用方决定是否拒绝。
 */

export interface BranchResolutionInput {
  /** 用户/脚本显式指定的分支。 */
  explicitBranch?: string | null;
  /** Project.config.source.branch。 */
  projectBranch?: string | null;
}

export interface BranchResolutionResult {
  /** 解析后的权威分支（显式优先，否则项目配置）。可能为 undefined。 */
  resolvedBranch: string | undefined;
  /** resolvedBranch 来自项目配置继承（显式缺失时）。 */
  resolvedFromProject: boolean;
  /** 分支不一致或缺失时的非阻断提示。 */
  warnings: string[];
}

function trim(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * 解析权威分支。显式分支优先；缺失时继承项目配置；不一致时给出 warning。
 * 纯函数，无副作用。
 */
export function resolveReleaseBranch(
  input: BranchResolutionInput,
): BranchResolutionResult {
  const explicit = trim(input.explicitBranch);
  const project = trim(input.projectBranch);
  const warnings: string[] = [];

  if (explicit) {
    if (project && explicit !== project) {
      warnings.push(
        `显式分支「${explicit}」与项目配置分支「${project}」不一致，请确认目标分支`,
      );
    }
    return { resolvedBranch: explicit, resolvedFromProject: false, warnings };
  }

  if (project) {
    return { resolvedBranch: project, resolvedFromProject: true, warnings };
  }

  warnings.push("未配置发布分支（既无显式分支也无项目配置 source.branch），Git checkout 将无法执行");
  return { resolvedBranch: undefined, resolvedFromProject: false, warnings };
}

/**
 * 从 Project.config 读取 source.branch（与 DeploymentService.readBranch 同口径）。
 * 纯函数，便于在 orchestrator/preflight 共用。
 */
export function readProjectSourceBranch(config: unknown): string | undefined {
  if (!config || typeof config !== "object") return undefined;
  const source = (config as Record<string, unknown>).source;
  if (!source || typeof source !== "object") return undefined;
  return trim((source as Record<string, unknown>).branch);
}
