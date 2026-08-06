'use client';

import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  EnvironmentVersionRecoveryConfirmInput,
  EnvironmentVersionRecoveryPreview,
  EnvironmentVersionRecoveryReleaseRun,
} from '../types/environment-version.types';

interface RecoveryActionState {
  working: boolean;
  error: string;
}

export interface RecoveryCreateResult {
  run: EnvironmentVersionRecoveryReleaseRun;
  preview: EnvironmentVersionRecoveryPreview;
}

/**
 * Production 恢复发布确认 Hook。
 *
 * 单一职责：预览历史环境版本的恢复快照，并创建新的 recovery ReleaseRun + approval
 * （服务端用幂等键收敛并发，配置漂移时强制基于最新快照重新确认）。
 * create 内部总是先取最新预览再确认，保证 inputHash 是确认时刻的当前快照；
 * 双提交保护用 in-flight ref 完成（连点只发一次）。
 */
export function useRecoveryConfirm(projectId: string) {
  const [state, setState] = useState<RecoveryActionState>({ working: false, error: '' });
  const inFlight = useRef(false);

  const preview = useCallback(
    async (environmentId: string, sourceVersionId: string) => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setState({ working: true, error: '' });
      try {
        return await apiRequest<EnvironmentVersionRecoveryPreview>(
          `POST:/projects/${projectId}/delivery/environment-versions/${environmentId}/recovery/preview`,
          { sourceVersionId },
        );
      } catch (caught) {
        setState({ working: false, error: message(caught) });
        return null;
      } finally {
        inFlight.current = false;
        setState((current) => (current.working ? { ...current, working: false } : current));
      }
    },
    [projectId],
  );

  const create = useCallback(
    async (
      environmentId: string,
      sourceVersionId: string,
    ): Promise<RecoveryCreateResult | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setState({ working: true, error: '' });
      try {
        const preview = await apiRequest<EnvironmentVersionRecoveryPreview>(
          `POST:/projects/${projectId}/delivery/environment-versions/${environmentId}/recovery/preview`,
          { sourceVersionId },
        );
        const input: EnvironmentVersionRecoveryConfirmInput = {
          sourceVersionId,
          expectedInputHash: preview.inputHash,
          idempotencyKey: `production-recovery-${environmentId}-${sourceVersionId}`,
        };
        const run = await apiRequest<EnvironmentVersionRecoveryReleaseRun>(
          `POST:/projects/${projectId}/delivery/environment-versions/${environmentId}/recovery/confirm`,
          input,
        );
        return { run, preview };
      } catch (caught) {
        setState({ working: false, error: message(caught) });
        return null;
      } finally {
        inFlight.current = false;
        setState((current) => (current.working ? { ...current, working: false } : current));
      }
    },
    [projectId],
  );

  return { working: state.working, error: state.error, preview, create };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
