/**
 * 项目详情部署操作 Hook
 *
 * 单一职责：为项目详情页内联的 DeployWizardModal 提供两个 API 调用
 * —— createPlan（dry-run 预览）与 requestApproval（live 审批申请）。
 *
 * 与 applications 域的 use-application-operations 同源（同一后端端点
 * POST /deployments/projects/:projectId/runs），但不耦合 useApplications 的
 * 队列 / 服务操作 / running state 状态机 —— 项目详情页只需要部署这一条能力。
 *
 * 成功后调用 reload() 刷新项目部署运行历史（DeploymentPanel），由向导自行展示
 * commandPlan / 审批跳转；失败抛出，交由向导内联 ErrorBanner 处理。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type {
  ApplicationItem,
  ApplicationServiceItem,
  CreatedDeploymentRun,
} from '@/app/(dashboard)/applications/types';

export interface ProjectDeployOperations {
  createPlan: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    options?: { environmentId?: string; serverId?: string; branch?: string },
  ) => Promise<CreatedDeploymentRun>;
  requestApproval: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    input: {
      confirmationText: string;
      approvalReason?: string;
      environmentId?: string;
      serverId?: string;
      branch?: string;
    },
  ) => Promise<CreatedDeploymentRun>;
}

interface UseProjectDeployOperationsArgs {
  projectId: string;
  reload: () => Promise<void> | void;
}

export function useProjectDeployOperations({
  projectId,
  reload,
}: UseProjectDeployOperationsArgs): ProjectDeployOperations {
  const createPlan = usePersistFn(
    async (
      application: ApplicationItem,
      service: ApplicationServiceItem,
      options?: { environmentId?: string; serverId?: string; branch?: string },
    ): Promise<CreatedDeploymentRun> => {
      const run = await apiRequest<CreatedDeploymentRun>(
        `POST:/deployments/projects/${projectId}/runs`,
        {
          applicationId: application.id,
          applicationServiceId: service.id,
          environmentId: options?.environmentId ?? service.environment?.id,
          serverId: options?.serverId ?? service.server?.id,
          branch: options?.branch,
          dryRun: true,
        },
      );
      await reload();
      return run;
    },
  );

  const requestApproval = usePersistFn(
    async (
      application: ApplicationItem,
      service: ApplicationServiceItem,
      input: {
        confirmationText: string;
        approvalReason?: string;
        environmentId?: string;
        serverId?: string;
        branch?: string;
      },
    ): Promise<CreatedDeploymentRun> => {
      const run = await apiRequest<CreatedDeploymentRun>(
        `POST:/deployments/projects/${projectId}/runs`,
        {
          applicationId: application.id,
          applicationServiceId: service.id,
          environmentId: input.environmentId ?? service.environment?.id,
          serverId: input.serverId ?? service.server?.id,
          branch: input.branch,
          dryRun: false,
          confirmationText: input.confirmationText,
          approvalReason: input.approvalReason,
        },
      );
      await reload();
      return run;
    },
  );

  return { createPlan, requestApproval };
}
