import type { ProjectDirectoryItem } from '../types';

/** 列表页动态环境列（按环境在项目集合中首次出现的顺序去重）。 */
export interface DirectoryEnvColumn {
  id: string;
  key: string;
  name: string;
}

export function directoryEnvColumns(items: ProjectDirectoryItem[]): DirectoryEnvColumn[] {
  const seen = new Map<string, DirectoryEnvColumn>();
  for (const item of items) {
    for (const environment of item.environments) {
      // 生产基线环境不进动态列：其版本已由固定列「线上版本」承载，
      // 再出一列即重复（如本环境的"Production"列）。
      if (environment.baselineRole === 'production') continue;
      if (!seen.has(environment.key)) {
        seen.set(environment.key, {
          id: environment.id,
          key: environment.key,
          name: environment.name,
        });
      }
    }
  }
  return [...seen.values()];
}

/**
 * 环境列持久化模型：存「可见列」而非「隐藏列」。
 * 未配置/损坏 → null（调用方回退为空数组 = 出厂态：仅静态列「线上版本」，
 * 所有动态环境列默认隐藏，用户按需勾选）。新增环境天然默认隐藏，用户视图稳定。
 */
export const DIRECTORY_VISIBLE_ENV_COLUMNS_KEY = 'projects.directory.visibleEnvColumns';

export function parseVisibleEnvColumns(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return null;
  }
}

/** 过滤可见列：忽略已不存在的环境 key（脏数据防御）。 */
export function resolveVisibleEnvColumns(
  allEnvColumns: DirectoryEnvColumn[],
  visibleKeys: string[] | null,
): DirectoryEnvColumn[] {
  if (!visibleKeys) return [];
  const wanted = new Set(visibleKeys);
  return allEnvColumns.filter((column) => wanted.has(column.key));
}

/** 环境单元格的就绪语义：仅 staging/production 基线有 ready 判定。 */
export function environmentReadyFor(
  project: ProjectDirectoryItem,
  environmentId: string,
): boolean | null {
  const baselines = [project.baselines.staging, project.baselines.production];
  const matched = baselines.find((baseline) => baseline?.id === environmentId);
  return matched ? matched.ready : null;
}

/** 组件列展示格式：`[组件]:[端口]`，无端口仅名称。 */
export function directoryComponentLabel(
  components: Array<{ name: string; port: number | null }>,
): string {
  return components
    .map((component) =>
      component.port !== null ? `${component.name}:${component.port}` : component.name,
    )
    .join(' · ');
}
