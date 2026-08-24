'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../types/release-order.types';
import {
  readExplicitReleaseOrderStep,
  releaseOrderHref,
  releaseOrderListHref,
  type ReleaseChainNode,
  type ReleaseHistoryTab,
} from '../utils/project-route.utils';
import { settingsEnvironmentTabHref } from '../utils/settings-environment-route';
import type { ReleaseWorkbenchStep } from '../components/release-workbench/release-workbench-steps.model';
import { workbenchExecutionStep } from '../components/release-workbench/release-workbench-steps.model';

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
        (input.detail ? (workbenchExecutionStep(input.detail.resumeStep) ?? 'staging') : 'preflight'));
  const openHistory: ReleaseHistoryTab | null = release === 'staging' ? history : null;

  useEffect(() => {
    if (!input.detail) return;
    const canonical = canonicalParams(searchParams);
    if (!canonical) return;
    router.replace(canonicalHref(canonical, input.projectId, input.releaseOrderId), {
      scroll: false,
    });
  }, [input.detail, input.projectId, input.releaseOrderId, router, searchParams]);

  const replace = (next: {
    step?: ReleaseWorkbenchStep | null;
    chain?: ReleaseChainNode;
    history?: ReleaseHistoryTab | null;
    focus?: { buildRunId?: string; deploymentRunId?: string; releaseRunId?: string };
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
    releaseRunId,
    selectRelease: (node: ReleaseChainNode) =>
      replace({ chain: node, step: null, history: null, focus: {} }),
    selectStep: (next: ReleaseWorkbenchStep) => replace({ step: next }),
    openBuildHistory: () => replace({ history: 'builds', focus: {} }),
    openDeployHistory: () => replace({ history: 'deploys', focus: {} }),
    closeHistory: () => replace({ history: null, focus: {} }),
    /** 直接打开运行日志（单层抽屉，不经过历史列表）。 */
    openBuildLog: (runId: string) => replace({ history: null, focus: { buildRunId: runId } }),
    openDeployLog: (runId: string) =>
      replace({ history: null, focus: { deploymentRunId: runId } }),
    /** 历史抽屉内的行级日志（二层）。 */
    openBuildHistoryLog: (runId: string) =>
      replace({ history: 'builds', focus: { buildRunId: runId } }),
    openDeployHistoryLog: (runId: string) =>
      replace({ history: 'deploys', focus: { deploymentRunId: runId } }),
    closeLog: () => replace({ focus: {} }),
    openProductionLog: (runId: string) => replace({ chain: 'production', focus: { releaseRunId: runId } }),
    closeProductionLog: () => replace({ chain: 'production', focus: {} }),
    back: () => router.replace(releaseOrderListHref(input.projectId, searchParams)),
    recoveryHref: settingsEnvironmentTabHref(input.projectId, null, 'versions'),
  };
}

interface CanonicalParams {
  step: ReleaseWorkbenchStep | null;
  chain: ReleaseChainNode;
  history: ReleaseHistoryTab | null;
  focus: { buildRunId?: string; deploymentRunId?: string; releaseRunId?: string };
}

/**
 * URL 与规范态不一致时返回规范参数（触发一次 replace）；一致返回 null。
 * 规则见 hook 顶部注释；缺省值（无 release/step 参数）不回写 URL。
 */
function canonicalParams(searchParams: URLSearchParams): CanonicalParams | null {
  const rawStep = searchParams.get('step');
  const explicitStep = readExplicitReleaseOrderStep(searchParams);
  const buildRunId = searchParams.get('buildRunId')?.trim() || undefined;
  const deploymentRunId = searchParams.get('deploymentRunId')?.trim() || undefined;
  const releaseRunId = searchParams.get('releaseRunId')?.trim() || undefined;
  const historyParam = searchParams.get('history');
  const history =
    historyParam === 'builds' || historyParam === 'deploys' ? historyParam : null;
  const releaseParam = searchParams.get('release');

  if (rawStep !== null && !explicitStep) return canonicalFrom(searchParams, 'invalid-step');
  if (releaseParam !== null && releaseParam !== 'production' && releaseParam !== 'staging')
    return canonicalFrom(searchParams, 'invalid-release');
  if (historyParam !== null && !history) return canonicalFrom(searchParams, 'invalid-history');
  if (explicitStep === 'production' || releaseRunId)
    return canonicalFrom(searchParams, 'production');
  // 裸聚焦（无 history）= 直接日志抽屉，是合法状态；仅清理 history 与聚焦错配。
  if (history === 'builds' && deploymentRunId) return canonicalFrom(searchParams, 'builds');
  if (history === 'deploys' && buildRunId) return canonicalFrom(searchParams, 'deploys');
  if (releaseParam === 'production' && (history || buildRunId || deploymentRunId))
    return canonicalFrom(searchParams, 'production');
  return null;
}

function canonicalFrom(searchParams: URLSearchParams, mode: string): CanonicalParams {
  const explicitStep = readExplicitReleaseOrderStep(searchParams);
  const buildRunId = searchParams.get('buildRunId')?.trim() || undefined;
  const deploymentRunId = searchParams.get('deploymentRunId')?.trim() || undefined;
  const releaseRunId = searchParams.get('releaseRunId')?.trim() || undefined;
  const historyParam = searchParams.get('history');
  const history =
    historyParam === 'builds' || historyParam === 'deploys' ? historyParam : null;
  if (mode === 'production') {
    return {
      step: null,
      chain: 'production',
      history: null,
      focus: { releaseRunId },
    };
  }
  const step = (explicitStep as ReleaseWorkbenchStep | null) ?? null;
  if (mode === 'builds') return { step, chain: 'staging', history: 'builds', focus: { buildRunId } };
  if (mode === 'deploys')
    return { step, chain: 'staging', history: 'deploys', focus: { deploymentRunId } };
  // invalid-* / orphan-focus：保留合法 step，清掉不合法或孤儿参数。
  return { step, chain: 'staging', history, focus: {} };
}

function canonicalHref(
  canonical: CanonicalParams,
  projectId: string,
  releaseOrderId: string,
) {
  return releaseOrderHref(
    projectId,
    releaseOrderId,
    canonical.step,
    new URLSearchParams(),
    canonical.focus,
    canonical.chain,
    canonical.history ?? undefined,
  );
}

export type ReleaseOrderWorkbenchNavigation = ReturnType<typeof useReleaseOrderWorkbenchNavigation>;
