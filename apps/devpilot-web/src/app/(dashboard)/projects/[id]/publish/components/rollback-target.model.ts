/**
 * 回滚目标模型（纯函数，第 0 步）
 *
 * 单一职责：从版本历史解析「回滚到上一版本」的目标 —— 生产环境当前版本的
 * 上一版本；无生产环境或无上一版本时返回 null（界面提示无可回滚版本）。
 */

import type { EnvironmentVersionsResponse } from '../../types/environment-version.types';

export interface RollbackTarget {
  environmentId: string;
  currentVersionId: string;
  previousVersionId: string;
}

export function resolveRollbackTarget(
  versions: EnvironmentVersionsResponse | null,
): RollbackTarget | null {
  const environment =
    versions?.environments.find((item) => item.baselineRole === 'production') ?? null;
  if (!environment?.currentEnvironmentVersionId) return null;
  const current = environment.environmentVersions.find(
    (version) => version.id === environment.currentEnvironmentVersionId,
  );
  if (!current?.previousVersionId) return null;
  return {
    environmentId: environment.id,
    currentVersionId: current.id,
    previousVersionId: current.previousVersionId,
  };
}
