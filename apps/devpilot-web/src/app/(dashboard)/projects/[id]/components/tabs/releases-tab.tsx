/**
 * 发布 Tab 宿主（F383, items 9-13）
 *
 * 单一职责：加载发布计划列表 + URL 恢复（releasePlanId + stageId 深链）+ 轮询 +
 * capability 拉取 + 只读横幅 + 子组件编排。
 * 动作调用委托 useReleaseActions；渲染委托 ConclusionHeader / ReleaseStageCard / CreateWizard。
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmptyState, LoadingState } from '@svton/ui';
import { Alert, Button, ErrorBanner } from '@/components/ui';
import { useProjectDetail } from '../../hooks/use-project-detail';
import { useProjectReleaseOperations } from '../../hooks/use-project-release-operations';
import { useReleaseCapability } from '../../hooks/use-release-capability.hooks';
import { useReleasePolling } from '../../hooks/use-release-polling.hooks';
import { useReleaseActions } from '../../hooks/use-release-actions.hooks';
import { deriveConclusion } from '../../utils/release-conclusion.utils';
import { formatReleaseStageName } from '../../utils/release-labels';
import { topologicalSortStages } from '../../utils/release-stage-topology.utils';
import { ReleaseConclusionHeader } from '../release-conclusion-header.component';
import { ReleaseStageCard } from '../release-stage-card.component';
import { ReleaseHistoryToolbar } from '../release-history-toolbar.component';
import { ReleaseOutcomeSummary } from '../release-outcome-summary.component';
import { ReleaseTabDialogs } from '../release-tab-dialogs.component';
import type { ReleasePlan } from '../../types/releases';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ReleasesTab({ detail }: { detail: DetailHook }): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = detail.project?.id ?? '';
  const [plans, setPlans] = useState<ReleasePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const stageIdFromUrl = searchParams.get('stageId') ?? '';

  const ops = useProjectReleaseOperations({ projectId, reload: () => loadPlans() });
  const { capability } = useReleaseCapability({ projectId, fetcher: ops.capability });
  const actions = useReleaseActions(ops, selectedPlanId);

  const loadPlans = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setPlans(await ops.list());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  // URL 恢复：releasePlanId。
  useEffect(() => {
    const fromUrl = searchParams.get('releasePlanId');
    if (fromUrl && fromUrl !== selectedPlanId) {
      setSelectedPlanId(fromUrl);
    } else if (!fromUrl && plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id);
    }
  }, [searchParams, plans, selectedPlanId]);

  const selectPlan = useCallback(
    (planId: string) => {
      setSelectedPlanId(planId);
      const next = new URLSearchParams(searchParams.toString());
      if (planId) next.set('releasePlanId', planId);
      else next.delete('releasePlanId');
      next.delete('stageId');
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );
  useReleasePolling({ selectedPlan, reload: loadPlans });

  const conclusion = useMemo(() => deriveConclusion(selectedPlan), [selectedPlan]);
  const orderedStages = useMemo(
    () => topologicalSortStages(selectedPlan?.stages ?? []),
    [selectedPlan],
  );

  const onExpandChange = useCallback(
    (stageId: string, expanded: boolean) => {
      const next = new URLSearchParams(searchParams.toString());
      if (expanded) next.set('stageId', stageId);
      else if (next.get('stageId') === stageId) next.delete('stageId');
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  if (loading && plans.length === 0) return <LoadingState />;
  const flagOff = capability?.enabled === false;

  return (
    <div className="space-y-4">
      <ReleaseHistoryToolbar
        plans={plans}
        selectedPlanId={selectedPlanId}
        loading={loading}
        createDisabled={flagOff}
        onSelect={selectPlan}
        onReload={() => void loadPlans()}
        onCreate={() => setShowCreate(true)}
      />

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => loadPlans()}
        />
      )}
      {flagOff && (
        <Alert tone="warning">历史发布只读；新发布功能未开启（取消仍可用作逃生通道）</Alert>
      )}

      {selectedPlan ? (
        <>
          <ReleaseConclusionHeader
            plan={selectedPlan}
            conclusion={conclusion}
            capability={capability}
            preview={null}
            loadingExecute={actions.loadingAction === `execute:${selectedPlan.id}`}
            loadingCancel={actions.loadingAction === `cancel:${selectedPlan.id}`}
            onExecute={() => actions.handleExecute(selectedPlan.id)}
            onCancel={() => actions.handleCancel(selectedPlan.id)}
          />
          <ReleaseOutcomeSummary plan={selectedPlan} />
          <div className="space-y-3">
            {orderedStages.map((stage) => (
              <ReleaseStageCard
                key={stage.id}
                stage={stage}
                plan={selectedPlan}
                capability={capability}
                defaultExpanded={stage.id === stageIdFromUrl}
                onExpandChange={onExpandChange}
                loadingAction={actions.loadingAction}
                onRetry={(stageId) =>
                  actions.openRetry(
                    stageId,
                    formatReleaseStageName(stage.name, stage.type),
                    stage.currentAttempt + 1,
                  )
                }
                onSkip={(stageId) => actions.openSkip(stageId, stage.name)}
                onReRequestApproval={actions.handleReRequestApproval}
              />
            ))}
          </div>
        </>
      ) : (
        !showCreate && (
          <EmptyState
            text="暂无发布计划"
            description="从真实项目配置生成发布预览，按依赖编排数据与应用阶段。"
            action={
              <Button
                onClick={() => setShowCreate(true)}
                disabled={flagOff}
              >
                新建发布
              </Button>
            }
          />
        )
      )}

      <ReleaseTabDialogs
        detail={detail}
        ops={ops}
        actions={actions}
        createOpen={showCreate}
        onCreateOpenChange={setShowCreate}
        onCreated={(id) => {
          setShowCreate(false);
          selectPlan(id);
        }}
      />
    </div>
  );
}
