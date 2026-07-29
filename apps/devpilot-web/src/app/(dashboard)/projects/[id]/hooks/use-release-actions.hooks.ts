/**
 * 发布动作编排 Hook（F383）
 *
 * 单一职责：封装 execute/cancel/retry/skip/re-request-approval 的调用 + loading 态 +
 * 错误分类（release-error-taxonomy）+ skip 弹窗状态。
 * 成功才 Toast；失败按错误分类展示，不在抛出路径上假成功。
 */
'use client';

import { useCallback, useState } from 'react';
import { feedback } from '@/components/ui/feedback/feedback';
import { classifyReleaseError } from '../utils/release-error-taxonomy.utils';
import type { useProjectReleaseOperations } from './use-project-release-operations';

type Ops = ReturnType<typeof useProjectReleaseOperations>;

export interface ReleaseSkipTarget {
  stageId: string;
  stageName: string;
}

export interface UseReleaseActionsResult {
  loadingAction: string | null;
  skipTarget: ReleaseSkipTarget | null;
  setSkipTarget: (t: ReleaseSkipTarget | null) => void;
  handleExecute: (planId: string) => Promise<void>;
  handleCancel: (planId: string) => Promise<void>;
  handleRetry: (stageId: string) => Promise<void>;
  handleReRequestApproval: (stageId: string) => Promise<void>;
  handleSkipConfirm: (body: { reason: string; confirmationText: string }) => Promise<void>;
  openSkip: (stageId: string, stageName: string) => void;
}

export function useReleaseActions(ops: Ops, selectedPlanId: string): UseReleaseActionsResult {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [skipTarget, setSkipTarget] = useState<ReleaseSkipTarget | null>(null);

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
      try {
        setLoadingAction(key);
        await fn();
        feedback.success(okMsg);
      } catch (err) {
        feedback.error(classifyReleaseError(err).message);
      } finally {
        setLoadingAction(null);
      }
    },
    [],
  );

  const handleExecute = useCallback(
    (planId: string) =>
      run(`execute:${planId}`, () => ops.execute(planId), '已提交执行，请关注下方结论'),
    [ops, run],
  );
  const handleCancel = useCallback(
    (planId: string) => run(`cancel:${planId}`, () => ops.cancel(planId), '发布已取消'),
    [ops, run],
  );
  const handleRetry = useCallback(
    (stageId: string) =>
      run(`retry:${stageId}`, () => ops.retryStage(selectedPlanId, stageId), '阶段已重新排队'),
    [ops, selectedPlanId, run],
  );
  const handleReRequestApproval = useCallback(
    (stageId: string) =>
      run(`reapprove:${stageId}`, () => ops.reRequestApproval(selectedPlanId, stageId), '已重新请求审批'),
    [ops, selectedPlanId, run],
  );
  const handleSkipConfirm = useCallback(
    async (body: { reason: string; confirmationText: string }) => {
      if (!skipTarget) return;
      await run(
        `skip:${skipTarget.stageId}`,
        () => ops.skipStage(selectedPlanId, skipTarget.stageId, body),
        '阶段已跳过',
      );
    },
    [ops, selectedPlanId, skipTarget, run],
  );
  const openSkip = useCallback((stageId: string, stageName: string) => {
    setSkipTarget({ stageId, stageName });
  }, []);

  return {
    loadingAction,
    skipTarget,
    setSkipTarget,
    handleExecute,
    handleCancel,
    handleRetry,
    handleReRequestApproval,
    handleSkipConfirm,
    openSkip,
  };
}
