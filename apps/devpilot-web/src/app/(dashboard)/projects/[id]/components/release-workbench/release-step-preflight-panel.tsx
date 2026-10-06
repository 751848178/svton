/**
 * 步骤 01 内联面板 · 前置检查（当前状态，无轮次概念）：
 * 仓库与环境基线事实 + 发布准入门禁目录。
 */
'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { LoadingState } from '@svton/ui';
import type { useReleaseGateCatalog } from '../../hooks/use-release-gate-catalog';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { settingsEnvironmentTabHref } from '../../utils/settings-environment-route';
import { releaseActionGate } from '../release-action-gate.model';
import { releaseOrderStepLabelKey } from '../release-order-stepper.model';
import { ReleasePreflightCheckList } from './release-preflight-check-list';
import {
  releasePreflightCheckRows,
  releasePreflightDecision,
} from './release-preflight-checks.model';
import { ReleasePreflightDecisionSummary } from './release-preflight-decision-summary';
import { ReleasePreflightEvidenceDrawer } from './release-preflight-evidence-drawer';
import { FlowStatusTag } from './release-flow-status-tag';
import {
  releaseWorkbenchDecisionStep,
  releaseWorkbenchGateStage,
} from './release-workbench-summary.model';

interface Props {
  projectId: string;
  detail: ReleaseOrderDetail;
  gateCatalog: ReturnType<typeof useReleaseGateCatalog>;
}

export function ReleaseStepPreflightPanel(props: Props) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const [focusedGateId, setFocusedGateId] = useState<string | null>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const { repository, staging, production } = props.detail.preflight;
  const decisionStep = releaseWorkbenchDecisionStep(props.detail);
  const stage = releaseWorkbenchGateStage(decisionStep);
  const catalog = props.gateCatalog.catalog;
  const decision = catalog ? releasePreflightDecision(catalog, stage) : null;
  const rows = catalog ? releasePreflightCheckRows(catalog, stage) : [];
  const focusedRow = rows.find((row) => row.check.id === focusedGateId) ?? null;
  const actionGate = releaseActionGate(
    catalog,
    stage,
    { loading: props.gateCatalog.loading, error: props.gateCatalog.error },
    locale,
  );
  const targetRepairHref =
    catalog && actionGate.repairArea === 'targets'
      ? settingsEnvironmentTabHref(
          props.projectId,
          catalog.targetReadiness.environmentKey,
          'targets',
        )
      : null;
  const closeDrawer = () => {
    const returnId = focusedGateId;
    setFocusedGateId(null);
    requestAnimationFrame(() => returnId && triggerRefs.current.get(returnId)?.focus());
  };

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-3">
        <Baseline
          label={t('releasePreflightRepository')}
          value={repository.branch || t('releasePreflightBranchMissing')}
          ready={repository.ready}
        />
        <Baseline
          label={t('releasePreflightStaging')}
          value={t('releasePreflightBaselineDescription')}
          ready={staging.ready}
        />
        <Baseline
          label={t('releasePreflightProduction')}
          value={t('releasePreflightBaselineDescription')}
          ready={production.ready}
        />
      </dl>
      {props.gateCatalog.loading && !catalog ? (
        <LoadingState text={t('loading')} />
      ) : !catalog ? (
        <div
          role={props.gateCatalog.error ? 'alert' : undefined}
          className="rounded-lg border p-4 text-sm"
        >
          <p className={props.gateCatalog.error ? 'text-destructive' : 'text-muted-foreground'}>
            {props.gateCatalog.error || t('releasePreflightNoChecks')}
          </p>
          {props.gateCatalog.error ? (
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => void props.gateCatalog.load()}
            >
              {t('retry')}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ReleasePreflightDecisionSummary
            actionGate={actionGate}
            decision={decision}
            loading={props.gateCatalog.loading}
            stageLabel={t(releaseOrderStepLabelKey(decisionStep))}
            targetRepairHref={targetRepairHref}
            onRefresh={() => void props.gateCatalog.load()}
          />
          <ReleasePreflightCheckList
            rows={rows}
            registerTrigger={(id, node) =>
              node ? triggerRefs.current.set(id, node) : triggerRefs.current.delete(id)
            }
            onOpen={setFocusedGateId}
          />
          <ReleasePreflightEvidenceDrawer
            catalog={catalog}
            row={focusedRow}
            confirmingGateId={props.gateCatalog.confirmingGateId}
            confirmationError={props.gateCatalog.confirmationError}
            onConfirmManual={props.gateCatalog.confirmManual}
            onClose={closeDrawer}
          />
        </>
      )}
    </div>
  );
}

function Baseline(props: { label: string; value: string; ready: boolean }) {
  const t = useTranslations('projects');
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 flex min-w-0 items-center gap-2">
        <FlowStatusTag
          className="shrink-0 whitespace-nowrap"
          status={props.ready ? 'success' : 'warning'}
          label={t(props.ready ? 'releasePreflightReady' : 'releasePreflightBlocked')}
        />
        <span
          className="min-w-0 truncate text-xs text-muted-foreground"
          title={props.value}
        >
          {props.value}
        </span>
      </dd>
    </div>
  );
}
