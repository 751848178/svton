/**
 * 项目详情发布操作 Hook（F383）
 *
 * 单一职责：调用 /release-plans 接口，提供预览/创建/执行/取消/重试/跳过/列表/详情。
 * 成功后调用 reload() 刷新发布计划列表；失败抛出，交由调用方内联 ErrorBanner 处理。
 * 所有操作区分「审批中 / 已排队 / 执行成功」等状态，不做假成功 Toast。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type {
  ReleasePlan,
  ReleasePlanPreview,
  ReleaseServiceInputItem,
} from '../types/releases';

export interface ReleasePlanBuildInput {
  environmentId: string;
  name: string;
  branch?: string;
  commitSha?: string;
  services: ReleaseServiceInputItem[];
}

export interface ProjectReleaseOperations {
  preview: (input: ReleasePlanBuildInput) => Promise<ReleasePlanPreview>;
  create: (input: ReleasePlanBuildInput) => Promise<{ id: string; planHash: string }>;
  list: () => Promise<ReleasePlan[]>;
  get: (planId: string) => Promise<ReleasePlan>;
  execute: (planId: string) => Promise<{ planId: string; status: string }>;
  cancel: (planId: string) => Promise<{ planId: string; status: string }>;
  retryStage: (planId: string, stageId: string) => Promise<{ planId: string; stageId: string; status: string }>;
  skipStage: (
    planId: string,
    stageId: string,
    body: { reason: string; confirmationText: string },
  ) => Promise<{ planId: string; stageId: string; status: string }>;
}

interface UseProjectReleaseOperationsArgs {
  projectId: string;
  reload: () => Promise<void> | void;
}

export function useProjectReleaseOperations({
  projectId,
  reload,
}: UseProjectReleaseOperationsArgs): ProjectReleaseOperations {
  const preview = usePersistFn(async (input: ReleasePlanBuildInput) => {
    return apiRequest<ReleasePlanPreview>(
      `POST:/release-plans/projects/${projectId}/preview`,
      input,
    );
  });

  const create = usePersistFn(async (input: ReleasePlanBuildInput) => {
    const result = await apiRequest<{ id: string; planHash: string }>(
      `POST:/release-plans/projects/${projectId}`,
      input,
    );
    await reload();
    return result;
  });

  const list = usePersistFn(async () => {
    return apiRequest<ReleasePlan[]>('GET:/release-plans', { projectId });
  });

  const get = usePersistFn(async (planId: string) => {
    return apiRequest<ReleasePlan>(`GET:/release-plans/${planId}`);
  });

  const execute = usePersistFn(async (planId: string) => {
    const result = await apiRequest<{ planId: string; status: string }>(
      `POST:/release-plans/${planId}/execute`,
    );
    await reload();
    return result;
  });

  const cancel = usePersistFn(async (planId: string) => {
    const result = await apiRequest<{ planId: string; status: string }>(
      `POST:/release-plans/${planId}/cancel`,
    );
    await reload();
    return result;
  });

  const retryStage = usePersistFn(async (planId: string, stageId: string) => {
    const result = await apiRequest<{ planId: string; stageId: string; status: string }>(
      `POST:/release-plans/${planId}/stages/${stageId}/retry`,
    );
    await reload();
    return result;
  });

  const skipStage = usePersistFn(
    async (
      planId: string,
      stageId: string,
      body: { reason: string; confirmationText: string },
    ) => {
      const result = await apiRequest<{ planId: string; stageId: string; status: string }>(
        `POST:/release-plans/${planId}/stages/${stageId}/skip`,
        body,
      );
      await reload();
      return result;
    },
  );

  return { preview, create, list, get, execute, cancel, retryStage, skipStage };
}
