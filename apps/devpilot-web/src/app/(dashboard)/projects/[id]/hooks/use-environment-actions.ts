/**
 * 环境写操作 Hook
 *
 * 单一职责:对单个 ProjectEnvironment 执行除「普通环境变量」之外的写操作——
 *   - update:编辑 name/status 等(PUT /project-environments/:id)
 *   - archive:归档即删除语义(DELETE /project-environments/:id,后端走 archive)
 *   - bindServer / unbindServer:绑定/解绑服务器
 *
 * 普通环境变量(envVars)的保存由 use-environment-env-vars 负责,本 Hook 不重复。
 * 所有写操作成功后回调 onSaved 通知父级刷新项目数据。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type { ProjectEnvironment } from '../types';

export type EnvironmentServerRole = 'deploy' | 'runtime' | 'database' | 'edge' | 'mixed';

export interface UseEnvironmentActionsArgs {
  environment: ProjectEnvironment | null;
  onSaved: (updated: ProjectEnvironment) => void;
}

export function useEnvironmentActions(args: UseEnvironmentActionsArgs) {
  const { environment, onSaved } = args;
  const t = useTranslations('projects');
  const [acting, setActing] = useState(false);

  const update = usePersistFn(
    async (
      patch: Partial<Pick<ProjectEnvironment, 'name' | 'description' | 'status'>> & {
        reason?: string;
      },
    ): Promise<boolean> => {
      if (!environment) return false;
      setActing(true);
      try {
        const updated = await apiRequest<ProjectEnvironment>(
          `PUT:/project-environments/${environment.id}`,
          patch,
        );
        const merged = { ...environment, ...(updated ?? patch) };
        onSaved(merged);
        feedback.success(t('envSaved'));
        return true;
      } catch (err) {
        feedback.error(t('envSaveFailed'), {
          description: err instanceof Error ? err.message : undefined,
        });
        return false;
      } finally {
        setActing(false);
      }
    },
  );

  const archive = usePersistFn(async (): Promise<boolean> => {
    if (!environment) return false;
    setActing(true);
    try {
      await apiRequest(`DELETE:/project-environments/${environment.id}`);
      onSaved({ ...environment, status: 'archived' });
      feedback.success(t('envArchived'));
      return true;
    } catch (err) {
      feedback.error(t('envArchiveFailed'), {
        description: err instanceof Error ? err.message : undefined,
      });
      return false;
    } finally {
      setActing(false);
    }
  });

  const bindServer = usePersistFn(
    async (
      serverId: string,
      role?: EnvironmentServerRole,
    ): Promise<boolean> => {
      if (!environment) return false;
      setActing(true);
      try {
        await apiRequest(`POST:/project-environments/${environment.id}/servers`, {
          serverId,
          role,
        });
        // 服务器绑定改动需父级重载才能拿到最新的 serverBindings
        onSaved(environment);
        feedback.success(t('envServerBound'));
        return true;
      } catch (err) {
        feedback.error(t('envBindServerFailed'), {
          description: err instanceof Error ? err.message : undefined,
        });
        return false;
      } finally {
        setActing(false);
      }
    },
  );

  const unbindServer = usePersistFn(
    async (bindingId: string, serverId: string): Promise<boolean> => {
      if (!environment) return false;
      setActing(true);
      try {
        await apiRequest(
          `DELETE:/project-environments/${environment.id}/servers/${serverId}`,
        );
        onSaved(environment);
        feedback.success(t('envServerUnbound'));
        return true;
      } catch (err) {
        feedback.error(t('envUnbindServerFailed'), {
          description: err instanceof Error ? err.message : undefined,
        });
        return false;
      } finally {
        setActing(false);
      }
    },
  );

  return { acting, update, archive, bindServer, unbindServer };
}
