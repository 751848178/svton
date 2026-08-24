/**
 * 预发发布「当前轮次」推导模型：
 * 最新构建 + 最新预发部署 + 生产发布应使用的制品。
 * 生产制品规则（与后端 stagingProof 校验一致）：
 * 已有生产运行 → 冻结为该制品；否则取最新一次预发部署成功的制品。
 */
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';

export function latestBuild(items: ReleaseBuildItem[]): ReleaseBuildItem | null {
  return [...items].sort(
    (left, right) =>
      right.revision - left.revision || Date.parse(right.createdAt) - Date.parse(left.createdAt),
  )[0] ?? null;
}

export function latestSuccessfulManifestBuild(items: ReleaseBuildItem[]): ReleaseBuildItem | null {
  return (
    latestBuild(items.filter((item) => item.status === 'succeeded' && item.manifest)) ?? null
  );
}

export function latestStagingDeployment(
  items: ReleaseStagingDeploymentItem[],
): ReleaseStagingDeploymentItem | null {
  return [...items].sort(byNewestFirst)[0] ?? null;
}

export function stagingProvenBuild(
  stagingRuns: ReleaseStagingDeploymentItem[],
  builds: ReleaseBuildItem[],
): ReleaseBuildItem | null {
  const completed = [...stagingRuns]
    .filter((run) => !run.dryRun && ['completed', 'succeeded'].includes(run.status.toLowerCase()))
    .sort(byNewestFirst)[0];
  if (!completed?.artifactManifestId) return null;
  return builds.find((build) => build.manifest?.id === completed.artifactManifestId) ?? null;
}

export function latestProductionRun(
  runs: ReleaseEvidenceProductionRun[],
): ReleaseEvidenceProductionRun | null {
  return [...runs].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]
    ?? null;
}

/** 生产发布制品：首次生产发布沿用预发验证通过的制品，其后冻结。 */
export function productionManifestBuild(input: {
  productionRuns: ReleaseEvidenceProductionRun[];
  stagingRuns: ReleaseStagingDeploymentItem[];
  builds: ReleaseBuildItem[];
}): ReleaseBuildItem | null {
  const frozenManifestId = latestProductionRun(input.productionRuns)?.artifactManifestId;
  if (frozenManifestId) {
    return input.builds.find((build) => build.manifest?.id === frozenManifestId) ?? null;
  }
  return stagingProvenBuild(input.stagingRuns, input.builds);
}

function byNewestFirst(
  left: ReleaseStagingDeploymentItem,
  right: ReleaseStagingDeploymentItem,
) {
  return (
    Date.parse(right.startedAt || right.createdAt) - Date.parse(left.startedAt || left.createdAt)
  );
}
