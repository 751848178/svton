/**
 * 构建轮询 API 助手（第 0 步，非 Hook）
 *
 * 单一职责：发布提交编排所需的构建列表读取与「本次触发构建」的追踪判定。
 * 追踪口径：优先用 POST /builds 返回的构建 ID；响应缺 ID 时以触发前已存在
 * 的构建 ID 集合为界，取列表中首个新出现的构建；历史构建一律不参与成败判定。
 */

import { apiRequest } from '@/lib/api-client';
import type {
  ReleaseBuildItem,
  ReleaseBuildListResponse,
} from '../../types/release-order.types';

export function findTrackedBuild(
  builds: ReleaseBuildItem[],
  createdId: string | null,
  priorBuildIds: Set<string>,
): ReleaseBuildItem | null {
  if (createdId) return builds.find((build) => build.id === createdId) ?? null;
  return builds.find((build) => !priorBuildIds.has(build.id)) ?? null;
}

export async function trackedBuild(
  pid: string,
  roid: string,
  createdId: string | null,
  priorBuildIds: Set<string>,
): Promise<ReleaseBuildItem | null> {
  const builds = await latestBuilds(pid, roid);
  return findTrackedBuild(builds, createdId, priorBuildIds);
}

export async function peekSucceededManifest(pid: string, roid: string): Promise<string | null> {
  const builds = await latestBuilds(pid, roid);
  const build = builds.find((item) => item.status === 'succeeded' && item.manifest);
  return build?.manifest?.id ?? null;
}

export async function existingBuildIds(pid: string, roid: string): Promise<Set<string>> {
  const builds = await latestBuilds(pid, roid);
  return new Set(builds.map((build) => build.id));
}

async function latestBuilds(pid: string, roid: string): Promise<ReleaseBuildItem[]> {
  const result = await apiRequest<ReleaseBuildListResponse>(
    `GET:/projects/${pid}/delivery/releases/${roid}/builds?take=10`,
  );
  return result.items;
}
