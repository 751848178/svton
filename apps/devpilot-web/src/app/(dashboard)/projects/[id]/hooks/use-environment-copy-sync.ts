/**
 * 环境复制/同步/新建 Hook
 *
 * 单一职责:封装跨环境复制(sites/cdn/resources)、项目级同步、新建环境的
 *   dryRun 预览 + 应用两步调用。应用(dryRun=false)由调用方在 ConfirmDialog 确认后触发,
 *   沿用后端 copyAccessPolicy / writeAccessPolicy 审批。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type {
  EnvironmentCdnConfigCopyResult,
  EnvironmentResourceCopyResult,
  EnvironmentSiteCopyResult,
} from '../types/environment-copy';
import type { EnvironmentSyncApplyResult } from '../types/environment-sync';
import type { ProjectEnvironment } from '../types';

type CopyKind = 'sites' | 'cdn' | 'resources';

/** 三种复制结果共用 plannedCount 字段,取并集类型让调用方直接读。 */
type CopyResult = EnvironmentSiteCopyResult | EnvironmentCdnConfigCopyResult | EnvironmentResourceCopyResult;

const COPY_PATH: Record<CopyKind, string> = {
  sites: 'sites',
  cdn: 'cdn-configs',
  resources: 'resources',
};

export interface CopyPreviewArgs {
  projectId: string;
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
  kind: CopyKind;
}

export interface UseEnvironmentCopySyncArgs {
  onChanged: () => void;
}

export function useEnvironmentCopySync(args: UseEnvironmentCopySyncArgs) {
  const { onChanged } = args;
  const t = useTranslations('projects');
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [syncingProject, setSyncingProject] = useState(false);
  const [creating, setCreating] = useState(false);

  const previewCopy = usePersistFn(
    async (a: CopyPreviewArgs): Promise<EnvironmentSiteCopyResult | EnvironmentCdnConfigCopyResult | EnvironmentResourceCopyResult | null> => {
      if (a.sourceEnvironmentId === a.targetEnvironmentId) {
        feedback.error(t('envCopySameEnv'));
        return null;
      }
      setPreviewing(true);
      try {
        const body = { projectId: a.projectId, sourceEnvironmentId: a.sourceEnvironmentId, targetEnvironmentId: a.targetEnvironmentId, dryRun: true };
        return await apiRequest<CopyResult>(
          `POST:/project-environments/${COPY_PATH[a.kind]}/copy`,
          body,
        );
      } catch (err) {
        feedback.error(t('envCopyPreviewFailed'), { description: err instanceof Error ? err.message : undefined });
        return null;
      } finally {
        setPreviewing(false);
      }
    },
  );

  const applyCopy = usePersistFn(
    async (
      a: CopyPreviewArgs,
    ): Promise<boolean> => {
      setApplying(true);
      try {
        const body = { projectId: a.projectId, sourceEnvironmentId: a.sourceEnvironmentId, targetEnvironmentId: a.targetEnvironmentId, dryRun: false };
        await apiRequest(
          `POST:/project-environments/${COPY_PATH[a.kind]}/copy`,
          body,
        );
        onChanged();
        feedback.success(t('envCopyApplied'));
        return true;
      } catch (err) {
        feedback.error(t('envCopyApplyFailed'), { description: err instanceof Error ? err.message : undefined });
        return false;
      } finally {
        setApplying(false);
      }
    },
  );

  const applySyncSuggestions = usePersistFn(
    async (
      projectId: string,
      sourceEnvironmentId: string,
      targetEnvironmentId: string,
    ): Promise<boolean> => {
      setApplying(true);
      try {
        const result = await apiRequest<EnvironmentSyncApplyResult>(
          'POST:/project-environments/sync-suggestions/apply',
          { projectId, sourceEnvironmentId, targetEnvironmentId, dryRun: false },
        );
        onChanged();
        feedback.success(t('envSyncApplied', { applied: result.appliedCount }));
        return true;
      } catch (err) {
        feedback.error(t('envSyncApplyFailed'), { description: err instanceof Error ? err.message : undefined });
        return false;
      } finally {
        setApplying(false);
      }
    },
  );

  const previewSyncSuggestions = usePersistFn(
    async (
      projectId: string,
      sourceEnvironmentId: string,
      targetEnvironmentId: string,
    ): Promise<EnvironmentSyncApplyResult | null> => {
      if (sourceEnvironmentId === targetEnvironmentId) {
        feedback.error(t('envCopySameEnv'));
        return null;
      }
      setPreviewing(true);
      try {
        return await apiRequest<EnvironmentSyncApplyResult>(
          'POST:/project-environments/sync-suggestions/apply',
          { projectId, sourceEnvironmentId, targetEnvironmentId, dryRun: true },
        );
      } catch (err) {
        feedback.error(t('envSyncPreviewFailed'), { description: err instanceof Error ? err.message : undefined });
        return null;
      } finally {
        setPreviewing(false);
      }
    },
  );

  const syncFromProject = usePersistFn(async (projectId: string): Promise<boolean> => {
    setSyncingProject(true);
    try {
      await apiRequest('POST:/project-environments/sync-from-project', { projectId });
      onChanged();
      feedback.success(t('envSyncFromProjectDone'));
      return true;
    } catch (err) {
      feedback.error(t('envSyncFromProjectFailed'), { description: err instanceof Error ? err.message : undefined });
      return false;
    } finally {
      setSyncingProject(false);
    }
  });

  const createEnvironment = usePersistFn(
    async (
      projectId: string,
      data: { key: string; name: string; description?: string; sortOrder?: number },
    ): Promise<ProjectEnvironment | null> => {
      if (!data.key.trim() || !data.name.trim()) {
        feedback.error(t('envCreateRequired'));
        return null;
      }
      setCreating(true);
      try {
        const created = await apiRequest<ProjectEnvironment>('POST:/project-environments', {
          projectId,
          ...data,
        });
        onChanged();
        feedback.success(t('envCreated'));
        return created;
      } catch (err) {
        feedback.error(t('envCreateFailed'), { description: err instanceof Error ? err.message : undefined });
        return null;
      } finally {
        setCreating(false);
      }
    },
  );

  return {
    previewing,
    applying,
    syncingProject,
    creating,
    previewCopy,
    applyCopy,
    previewSyncSuggestions,
    applySyncSuggestions,
    syncFromProject,
    createEnvironment,
  };
}
