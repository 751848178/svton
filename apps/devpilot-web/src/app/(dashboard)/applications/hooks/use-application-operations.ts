/**
 * 应用服务操作 Hook
 *
 * 单一职责：部署计划生成、服务操作（状态/日志/重启/回滚）、Live 审批申请。
 * 拆出独立文件以保持 use-applications.ts <200 行。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { ApplicationItem, ApplicationServiceItem, ServiceAction } from '../types';

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

  const createDeploymentPlan = usePersistFn(
    async (application: ApplicationItem, service: ApplicationServiceItem) => {
      setDeployingServiceId(service.id);
      setError('');
      try {
        await apiRequest(`POST:/deployments/projects/${application.projectId}/runs`, {
          applicationId: application.id,
          applicationServiceId: service.id,
          environmentId: service.environment.id,
          serverId: service.server?.id,
          dryRun: true,
          queue: queueDeploymentRuns,
        });
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : '生成服务部署计划失败');
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

  return { createDeploymentPlan, runServiceOperation, requestServiceOperationApproval };
}
