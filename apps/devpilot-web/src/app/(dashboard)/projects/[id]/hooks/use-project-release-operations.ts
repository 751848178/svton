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
  ReleaseCapability,
  ReleasePlan,
  ReleasePlanPreview,
  ReleaseServiceInputItem,
} from '../types/releases';

export interface ReleasePlanBuildInput {
  environmentId: string;
  name: string;
  branch?: string;
  commitSha?: string;
  gitRepo?: string;
  /** 预览↔创建强绑定（invest-3 §C）：回传上一次 preview 的 planHash，不一致则 409。 */
  expectedPlanHash?: string;
  services: ReleaseServiceInputItem[];
  /**
   * 跨服务依赖边不再由客户端提交（P0-1）：由服务端从
   * ApplicationService.deployConfig.releaseDependencies 解析。此字段保留以维持
   * ReleasePlanBuildInput 的类型兼容，但 create/preview 不会把它送进请求体。
   */
  serviceDependencies?: never[];
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
  /** 重新请求审批（D5）：被拒绝/过期阶段重新生成待审批。 */
  reRequestApproval: (
    planId: string,
    stageId: string,
  ) => Promise<{ planId: string; stageId: string; status: string }>;
  /** 能力查询（D9）：GET /release-plans/capability，flag + 项目写权限。 */
  capability: (projectId?: string) => Promise<ReleaseCapability>;
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
    const payload = {
      ...input,
      // 恒发送 expectedPlanHash（即使 undefined 也由 DTO @IsOptional 容忍）。
      expectedPlanHash: input.expectedPlanHash,
    };
    const result = await apiRequest<{ id: string; planHash: string }>(
      `POST:/release-plans/projects/${projectId}`,
      payload,
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

  const reRequestApproval = usePersistFn(async (planId: string, stageId: string) => {
    const result = await apiRequest<{ planId: string; stageId: string; status: string }>(
      `POST:/release-plans/${planId}/stages/${stageId}/re-request-approval`,
    );
    await reload();
    return result;
  });

  const capability = usePersistFn(async (targetProjectId?: string) => {
    const query = targetProjectId ? { projectId: targetProjectId } : undefined;
    return apiRequest<ReleaseCapability>('GET:/release-plans/capability', query);
  });

  return {
    preview,
    create,
    list,
    get,
    execute,
    cancel,
    retryStage,
    skipStage,
    reRequestApproval,
    capability,
  };
}
