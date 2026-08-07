import {
  CurrentEnvironmentVersionScope,
  exactCurrentEnvironmentVersion,
} from "./current-environment-version.utils";

/**
 * 读侧 current 指针推导（AC-ENVVER-006，fail closed）。
 *
 * 列表读路径不信任 ProjectEnvironment.currentEnvironmentVersionId 的原始值：
 * 只有 exactCurrentEnvironmentVersion 语义可证明（completed、!dryRun、
 * source=release_order、精确 scope）时才返回版本 id，否则返回 null——
 * 绝不发明 current 指针。
 */
export function currentEnvironmentVersionId(
  project: { id: string; teamId: string },
  environment: CurrentEnvironmentVersionScope,
): string | null {
  return exactCurrentEnvironmentVersion(project, environment)?.id ?? null;
}
