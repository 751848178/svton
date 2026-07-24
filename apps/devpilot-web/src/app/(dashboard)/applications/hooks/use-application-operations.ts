/**
 * 应用服务操作 Hook
 *
 * 单一职责：部署计划生成（dry-run）、申请正式部署审批（live）、服务操作（状态/日志/重启/回滚）、
 * Live 服务操作审批申请。
 * 拆出独立文件以保持 use-applications.ts <200 行。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { CreatedDeploymentRun, ApplicationItem, ApplicationServiceItem, ServiceAction } from '../types';

interface UseApplicationOperationsArgs {
  queueDeploymentRuns: boolean;
  queueServiceOperations: boolean;
  setDeployingServiceId: (id: string) => void;
  setRunningOperation: (id: string) => void;
  setError: (error: string) => void;
  reload: () => Promise<void>;
}

export function useApplicationOperations(args: UseApplicationOperationsArgs) {
  const {
    queueDeploymentRuns,
    queueServiceOperations,
    setDeployingServiceId,
    setRunningOperation,
    setError,
    reload,
  } = args;

  /**
   * 生成部署计划（dry-run 预览）。
   *
   * 向导复用：不在此处 toast/reload，而是把创建的 run 返回给向导展示命令步骤 + 注入 KEY，
   * 由向导自行决定后续（仅查看 / 晋升 live）。失败时抛出，交调用方处理。
   */
  const createDeploymentPlan = usePersistFn(
    async (
      application: ApplicationItem,
      service: ApplicationServiceItem,
      options?: { environmentId?: string; serverId?: string; branch?: string },
    ): Promise<CreatedDeploymentRun> => {
      setDeployingServiceId(service.id);
      setError('');
      try {
        const run = await apiRequest<CreatedDeploymentRun>(
          `POST:/deployments/projects/${application.projectId}/runs`,
          {
            applicationId: application.id,
            applicationServiceId: service.id,
            environmentId: options?.environmentId ?? service.environment.id,
            serverId: options?.serverId ?? service.server?.id,
            branch: options?.branch,
            dryRun: true,
            queue: queueDeploymentRuns,
          },
        );
        await reload();
        return run;
      } catch (err) {
        const message = err instanceof Error ? err.message : '生成服务部署计划失败';
        setError(message);
        throw err;
      } finally {
        setDeployingServiceId('');
      }
    },
  );

  /**
   * 申请正式部署（live, 需审批）。
   *
   * 后端 createRun 在 dryRun:false 且无已批准 approval 时会自动创建 pending 审批单
   * 并把 run 置为 BLOCKED（deployment.service.ts:344-410）。要求 confirmationText = 项目名
   * （deployment.service.ts:434 requiredConfirmationText = project.name）。
   * 返回创建的 run（含 operationApproval 引用）。
   */
  const requestDeploymentApproval = usePersistFn(
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
      setDeployingServiceId(service.id);
      setError('');
      try {
        const run = await apiRequest<CreatedDeploymentRun>(
          `POST:/deployments/projects/${application.projectId}/runs`,
          {
            applicationId: application.id,
            applicationServiceId: service.id,
            environmentId: input.environmentId ?? service.environment.id,
            serverId: input.serverId ?? service.server?.id,
            branch: input.branch,
            dryRun: false,
            queue: queueDeploymentRuns,
            confirmationText: input.confirmationText,
            approvalReason: input.approvalReason,
          },
        );
        await reload();
        return run;
      } catch (err) {
        const message = err instanceof Error ? err.message : '申请正式部署审批失败';
        setError(message);
        throw err;
      } finally {
        setDeployingServiceId('');
      }
    },
  );

  const runServiceOperation = usePersistFn(
    async (
      application: ApplicationItem,
      service: ApplicationServiceItem,
      action: ServiceAction,
    ) => {
      setRunningOperation(`${service.id}:${action}`);
      setError('');
      try {
        await apiRequest(
          `POST:/applications/${application.id}/services/${service.id}/operations`,
          {
            action,
            dryRun: true,
            queue: queueServiceOperations,
          },
        );
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : '生成服务操作计划失败');
      } finally {
        setRunningOperation('');
      }
    },
  );

  const requestServiceOperationApproval = usePersistFn(
    async (
      application: ApplicationItem,
      service: ApplicationServiceItem,
      action: ServiceAction,
    ) => {
      setRunningOperation(`${service.id}:${action}:live`);
      setError('');
      try {
        await apiRequest(
          `POST:/applications/${application.id}/services/${service.id}/operations`,
          {
            action,
            dryRun: false,
            queue: queueServiceOperations,
            confirmationText: service.name,
            approvalReason: `申请对服务 ${service.name} 执行 ${action}`,
          },
        );
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : '申请服务操作审批失败');
      } finally {
        setRunningOperation('');
      }
    },
  );

  return {
    createDeploymentPlan,
    requestDeploymentApproval,
    runServiceOperation,
    requestServiceOperationApproval,
  };
}
