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

export interface ReleaseRetryTarget {
  stageId: string;
  stageName: string;
  nextAttemptNo: number;
}

export interface UseReleaseActionsResult {
  loadingAction: string | null;
  skipTarget: ReleaseSkipTarget | null;
  retryTarget: ReleaseRetryTarget | null;
  setSkipTarget: (t: ReleaseSkipTarget | null) => void;
  setRetryTarget: (t: ReleaseRetryTarget | null) => void;
  handleExecute: (planId: string) => Promise<void>;
  handleCancel: (planId: string) => Promise<void>;
  handleRetryConfirm: () => Promise<void>;
  handleReRequestApproval: (stageId: string) => Promise<void>;
  handleSkipConfirm: (body: { reason: string; confirmationText: string }) => Promise<void>;
  openSkip: (stageId: string, stageName: string) => void;
  openRetry: (stageId: string, stageName: string, nextAttemptNo: number) => void;
}

export function useReleaseActions(ops: Ops, selectedPlanId: string): UseReleaseActionsResult {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [skipTarget, setSkipTarget] = useState<ReleaseSkipTarget | null>(null);
  const [retryTarget, setRetryTarget] = useState<ReleaseRetryTarget | null>(null);

  const run = useCallback(async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    try {
      setLoadingAction(key);
      await fn();
      feedback.success(okMsg);
    } catch (err) {
      feedback.error(classifyReleaseError(err).message);
    } finally {
      setLoadingAction(null);
    }
  }, []);

  const handleExecute = useCallback(
    (planId: string) =>
      run(`execute:${planId}`, () => ops.execute(planId), '已提交执行，请关注下方结论'),
    [ops, run],
  );
  const handleCancel = useCallback(
    (planId: string) => run(`cancel:${planId}`, () => ops.cancel(planId), '发布已取消'),
    [ops, run],
  );
  const handleRetryConfirm = useCallback(async () => {
    if (!retryTarget) return;
    await run(
      `retry:${retryTarget.stageId}`,
      () => ops.retryStage(selectedPlanId, retryTarget.stageId),
      '阶段已重新排队',
    );
  }, [ops, retryTarget, run, selectedPlanId]);
  const handleReRequestApproval = useCallback(
    (stageId: string) =>
      run(
        `reapprove:${stageId}`,
        () => ops.reRequestApproval(selectedPlanId, stageId),
        '已重新请求审批',
      ),
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
  const openRetry = useCallback((stageId: string, stageName: string, nextAttemptNo: number) => {
    setRetryTarget({ stageId, stageName, nextAttemptNo });
  }, []);

  return {
    loadingAction,
    skipTarget,
    retryTarget,
    setSkipTarget,
    setRetryTarget,
    handleExecute,
    handleCancel,
    handleRetryConfirm,
    handleReRequestApproval,
    handleSkipConfirm,
    openSkip,
    openRetry,
  };
}
