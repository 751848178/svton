'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import {
  readExplicitReleaseOrderStep,
  releaseOrderHref,
  releaseOrderListHref,
  type ReleaseChainNode,
  type ReleaseHistoryTab,
  type ReleaseOrderFocus,
} from '../utils/project-route.utils';
import { settingsEnvironmentTabHref } from '../utils/settings-environment-route';
import type { ReleaseWorkbenchStep } from '../components/release-workbench/release-workbench-steps.model';
import { workbenchExecutionStep } from '../components/release-workbench/release-workbench-steps.model';
import {
  canonicalReleaseWorkbenchHref,
  canonicalReleaseWorkbenchParams,
} from './release-order-workbench-route.model';

/**
 * 预发发布工作台导航（全部 URL 驱动，可深链/回退）：
 * - `release`：环境发布链节点（staging=预发发布 | production=生产发布），默认 staging。
 * - `step`：预发视图内选中的步骤（preflight|build|staging），缺省取服务端 resumeStep。
 * - `history`：预发视图的历史抽屉（builds|deploys），由右侧构建/部署信息卡「查看历史」打开。
 * - 聚焦参数：裸 buildRunId/deploymentRunId = 直接打开该运行的日志详情抽屉（单层）；
 *   携带 history 时为历史抽屉内的二层日志；releaseRunId ⇒ 生产节点运行日志。
 */
export function useReleaseOrderWorkbenchNavigation(input: {
  projectId: string;
  releaseOrderId: string;
  detail: ReleaseOrderDetail | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = searchParams.get('step');
  const explicitStep = readExplicitReleaseOrderStep(searchParams);
  const buildRunId = searchParams.get('buildRunId')?.trim() || undefined;
  const deploymentRunId = searchParams.get('deploymentRunId')?.trim() || undefined;
  const deploymentEvidence: 'logs' | 'validation' =
    deploymentRunId && searchParams.get('deploymentEvidence') === 'validation'
      ? 'validation'
      : 'logs';
  const stagingStep: 'deploy' | 'validation' =
    searchParams.get('stagingStep') === 'validation' || deploymentEvidence === 'validation'
      ? 'validation'
      : 'deploy';
  const releaseRunId = searchParams.get('releaseRunId')?.trim() || undefined;
  const historyParam = searchParams.get('history');
  const history: ReleaseHistoryTab | null =
    historyParam === 'builds' || historyParam === 'deploys' ? historyParam : null;

  const legacyProductionStep = explicitStep === 'production';
  const release: ReleaseChainNode =
    searchParams.get('release') === 'production' || legacyProductionStep || releaseRunId
      ? 'production'
      : 'staging';
  const step: ReleaseWorkbenchStep =
    release === 'production'
      ? 'staging'
      : ((explicitStep as ReleaseWorkbenchStep | null) ??
        (input.detail
          ? (workbenchExecutionStep(input.detail.resumeStep) ?? 'staging')
          : 'preflight'));
  const openHistory: ReleaseHistoryTab | null = release === 'staging' ? history : null;

  useEffect(() => {
    if (!input.detail) return;
    const canonical = canonicalReleaseWorkbenchParams(searchParams);
    if (!canonical) return;
    router.replace(
      canonicalReleaseWorkbenchHref(canonical, input.projectId, input.releaseOrderId),
      {
        scroll: false,
      },
    );
  }, [input.detail, input.projectId, input.releaseOrderId, router, searchParams]);

  const replace = (next: {
    step?: ReleaseWorkbenchStep | null;
    chain?: ReleaseChainNode;
    history?: ReleaseHistoryTab | null;
    focus?: ReleaseOrderFocus;
  }) => {
    const nextHistory =
      next.history !== undefined ? next.history : (openHistory as ReleaseHistoryTab | null);
    const nextStep = next.step === null ? null : (next.step ?? step);
    return router.replace(
      releaseOrderHref(
        input.projectId,
        input.releaseOrderId,
        nextStep,
        searchParams,
        next.focus,
        next.chain ?? release,
        nextHistory ?? undefined,
      ),
      { scroll: false },
    );
  };

  return {
    searchParams,
    release,
    step,
    history: openHistory,
    buildRunId,
    deploymentRunId,
    deploymentEvidence,
    stagingStep,
    releaseRunId,
    selectRelease: (node: ReleaseChainNode) =>
      replace({ chain: node, step: null, history: null, focus: {} }),
    selectStep: (next: ReleaseWorkbenchStep) => replace({ step: next }),
    selectStagingStep: (next: 'stagingDeploy' | 'stagingValidation') =>
      replace({
        step: 'staging',
        focus: { stagingStep: next === 'stagingValidation' ? 'validation' : 'deploy' },
      }),
    openBuildHistory: () => replace({ history: 'builds', focus: {} }),
    openDeployHistory: () => replace({ history: 'deploys', focus: {} }),
    closeHistory: () => replace({ history: null, focus: {} }),
    /** 直接打开运行日志（单层抽屉，不经过历史列表）。 */
    openBuildLog: (runId: string) => replace({ history: null, focus: { buildRunId: runId } }),
    openDeployLog: (runId: string) =>
      replace({ history: null, focus: { deploymentRunId: runId, stagingStep: 'deploy' } }),
    openDeployEvidence: (runId: string) =>
      replace({
        history: null,
        focus: {
          deploymentRunId: runId,
          deploymentEvidence: 'validation',
          stagingStep: 'validation',
        },
      }),
    /** 历史抽屉内的行级日志（二层）。 */
    openBuildHistoryLog: (runId: string) =>
      replace({ history: 'builds', focus: { buildRunId: runId } }),
    openDeployHistoryLog: (runId: string) =>
      replace({ history: 'deploys', focus: { deploymentRunId: runId } }),
    closeLog: () => replace({ focus: { stagingStep } }),
    openProductionLog: (runId: string) =>
      replace({ chain: 'production', focus: { releaseRunId: runId } }),
    closeProductionLog: () => replace({ chain: 'production', focus: {} }),
    back: () => router.replace(releaseOrderListHref(input.projectId, searchParams)),
    recoveryHref: settingsEnvironmentTabHref(input.projectId, null, 'targets'),
  };
}

export type ReleaseOrderWorkbenchNavigation = ReturnType<typeof useReleaseOrderWorkbenchNavigation>;
