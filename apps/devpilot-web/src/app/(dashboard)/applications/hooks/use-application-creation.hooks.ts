/**
 * 应用/服务创建 Hook
 *
 * 单一职责：仅负责创建应用与创建服务的 API 调用 + 成功反馈 + 列表刷新。
 * 参数化回调（不持有任何表单状态）：表单状态由调用方（弹窗）自行管理。
 * 失败时抛出，由弹窗 try/catch 捕获并内联展示；成功时 toast 并 reload。
 */

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type { ApplicationItem, AppForm, ServiceForm } from '../types';
import { compactObject } from '../utils';

interface UseApplicationCreationArgs {
  reload: () => Promise<void>;
}

/**
 * 创建应用入参：与 AppForm 同构（projectId 必填、name 必填，其余可选）。
 */
export type AppInput = AppForm;

/**
 * 创建服务入参：复用 ServiceForm 全量字段（applicationId 由 createService 的
 * 显式入参提供，此处仅作为字段载体，hook 内忽略 input.applicationId）。
 */
export type ServiceInput = ServiceForm;

export function useApplicationCreation({ reload }: UseApplicationCreationArgs) {
  const tc = useTranslations('common');

  const createApplication = usePersistFn(async (input: AppInput): Promise<ApplicationItem> => {
    const application = await apiRequest<ApplicationItem>('POST:/applications', {
      projectId: input.projectId,
      name: input.name.trim(),
      repositoryUrl: input.repositoryUrl || undefined,
      defaultBranch: input.defaultBranch || undefined,
      repoPath: input.repoPath || undefined,
    });
    feedback.success(tc('createSuccess'));
    await reload();
    return application;
  });

  const createService = usePersistFn(
    async (applicationId: string, input: ServiceInput): Promise<void> => {
      const deployConfig = compactObject({
        targetType: input.kind === 'external' ? 'external-ci' : 'server',
        workingDirectory: input.workingDirectory,
        buildCommand: input.buildCommand,
        deployCommand: input.deployCommand,
        healthCheckUrl: input.healthCheckUrl,
      });
      await apiRequest(`POST:/applications/${applicationId}/services`, {
        environmentId: input.environmentId,
        name: input.name.trim(),
        kind: input.kind,
        runtime: input.runtime || undefined,
        serverId: input.serverId || undefined,
        siteId: input.siteId || undefined,
        managedResourceId: input.managedResourceId || undefined,
        deployConfig: Object.keys(deployConfig).length > 0 ? deployConfig : undefined,
      });
      feedback.success(tc('createSuccess'));
      await reload();
    },
  );

  return { createApplication, createService };
}
