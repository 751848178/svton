'use client';

import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';

type ApprovalDecision = 'approved' | 'rejected';

interface ApprovalActionState {
  acting: boolean;
  error: string;
}

/**
 * 项目发布上下文审批动作 Hook。
 *
 * 单一职责：对当前 Production ReleaseRun 绑定的审批执行 批准/拒绝/生产执行。
 * 双提交保护用 in-flight ref 完成（连点只发一次）；成功后回调 onChanged 让证据列表刷新。
 */
export function useProductionApproval(
  projectId: string,
  run: ReleaseEvidenceProductionRun | null,
  onChanged: () => Promise<unknown>,
) {
  const [state, setState] = useState<ApprovalActionState>({ acting: false, error: '' });
  const inFlight = useRef(false);

  const review = useCallback(
    async (decision: ApprovalDecision, comment?: string) => {
      const approval = run?.operationApproval;
      if (!approval || inFlight.current) return false;
      inFlight.current = true;
      setState({ acting: true, error: '' });
      try {
        await apiRequest(`POST:/operation-approvals/${approval.id}/review`, {
          decision,
          reviewComment: comment?.trim() || undefined,
        });
        await onChanged();
        return true;
      } catch (caught) {
        setState({ acting: false, error: message(caught) });
        return false;
      } finally {
        inFlight.current = false;
        setState((current) => (current.acting ? { ...current, acting: false } : current));
      }
    },
    [onChanged, run],
  );

  const execute = useCallback(async () => {
    if (!run || inFlight.current) return false;
    inFlight.current = true;
    setState({ acting: true, error: '' });
    try {
      const isRecovery = run.mode === 'recovery';
      await apiRequest(
        `POST:/projects/${projectId}/delivery/environment-versions/${run.environmentId}/actions`,
        isRecovery
          ? { kind: 'recovery', releaseRunId: run.id, idempotencyKey: crypto.randomUUID() }
          : {
              kind: 'upgrade',
              manifestId: run.artifactManifestId,
              releaseRunId: run.id,
              idempotencyKey: crypto.randomUUID(),
            },
      );
      await onChanged();
      return true;
    } catch (caught) {
      setState({ acting: false, error: message(caught) });
      return false;
    } finally {
      inFlight.current = false;
      setState((current) => (current.acting ? { ...current, acting: false } : current));
    }
  }, [onChanged, projectId, run]);

  return {
    acting: state.acting,
    error: state.error,
    review,
    execute,
  };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
