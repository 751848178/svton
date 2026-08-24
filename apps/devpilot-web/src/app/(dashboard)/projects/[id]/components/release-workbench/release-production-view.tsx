/**
 * 环境发布链 · 生产节点视图（串行第二节）：
 * 复用预发验证通过的制品直接发布（不可选制品；首次生产运行后冻结），
 * 展示串行状态（制品/预发验证/审批/运行）与生产发布记录。
 *
 * PX-9：说明文案按预发技术验证的真实结论生成，不再无条件宣称「验证通过」。
 * PX-3：制品/预发验证用短哈希与短 ID，完整值进 title。
 * PX-18：发布钮禁用原因常驻可见，不再只写 title。
 */
'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, RocketLaunch } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button, LinkButton } from '@/components/ui';
import { FlowStatusTag } from './release-flow-status-tag';
import { ProductionConfirmModal } from '../../publish/components/production-confirm-modal';
import { useProductionReleases } from '../../hooks/use-production-releases';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { releaseExecutionStatusLabelKey } from '../../utils/release-copy.model';
import {
  shortDigest,
  shortTechnicalId,
} from '../../utils/release-display.utils';
import { stagingTechnicalConclusion } from '../../utils/release-staging-view.model';
import { latestProductionRun } from './release-round.model';
import { ReleaseProductionRunHistory } from './release-production-run-history';
import { ReleaseProductionRunLogDrawer } from './release-production-run-log-drawer';

interface Props {
  projectId: string;
  releaseOrderId: string;
  /** 生产发布制品：已有生产运行 → 冻结制品；否则最新预发验证通过的制品。 */
  manifestBuild: ReleaseBuildItem | null;
  stagingProof: ReleaseStagingDeploymentItem | null;
  productionRuns: ReleaseEvidenceProductionRun[];
  stagingProven: boolean;
  onChanged: () => Promise<unknown>;
  environmentHref: string;
  focusedRunId?: string;
  onFocusRun: (runId: string) => void;
  onCloseRunLog: () => void;
}

export function ReleaseProductionView(props: Props) {
  const t = useTranslations('projects');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const frozen = props.productionRuns.length > 0;
  const manifestId = props.manifestBuild?.manifest?.id || '';
  const production = useProductionReleases(
    props.projectId,
    props.releaseOrderId,
    manifestId,
    props.onChanged,
    !frozen && Boolean(manifestId),
  );
  const latest = useMemo(() => latestProductionRun(props.productionRuns), [props.productionRuns]);
  const focused = props.productionRuns.find((run) => run.id === props.focusedRunId) ?? null;
  const preflightBlocked =
    production.preview?.preflight?.decision?.preApprovalAllowed === false;
  const publishDisabled = !manifestId || production.loading || preflightBlocked;
  const publishDisabledReason = preflightBlocked
    ? t('releaseWorkbenchProductionPreflightBlocked')
    : !manifestId
      ? t('releaseWorkbenchPublishDisabledNoManifest')
      : production.loading
        ? t('productionPreviewLoading')
        : '';
  const stagingConclusion = props.stagingProof ? stagingTechnicalConclusion(props.stagingProof) : null;
  const stagingProofCopy = stagingConclusion
    ? stagingConclusion.key === 'releaseStagingVerificationPassed'
      ? t('productionStagingProof')
      : t('productionStagingProofNeutral')
    : t('productionStagingProofNeutral');

  return (
    <section
      className="min-w-0 space-y-5"
      aria-labelledby="release-production-view-title"
    >
      <div>
        <h3
          id="release-production-view-title"
          className="font-semibold"
        >
          {t('releaseChainNodeProduction')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{stagingProofCopy}</p>
      </div>

      {!props.stagingProven && !frozen ? (
        <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          {t('releaseRoundProductionWaitingNeutral')}
        </p>
      ) : (
        <>
          <dl className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-3">
            <Fact
              label={t('productionArtifact')}
              value={shortDigest(props.manifestBuild?.manifest?.digest)}
              title={props.manifestBuild?.manifest?.digest}
              mono
            />
            <Fact
              label={t('releaseProductionStagingProofLabel')}
              value={
                props.stagingProof
                  ? `DeploymentRun ${shortTechnicalId(props.stagingProof.id)}`
                  : (latest?.stagingProof?.deploymentRunId
                      ? `DeploymentRun ${shortTechnicalId(latest.stagingProof.deploymentRunId)}`
                      : '—')
              }
              title={props.stagingProof?.id ?? latest?.stagingProof?.deploymentRunId}
              mono
            />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">
                {t('releaseRoundProductionStatus')}
              </dt>
              <dd className="mt-1">
                {latest ? (
                  <FlowStatusTag
                    status={latest.status.toLowerCase()}
                    label={t(releaseExecutionStatusLabelKey(latest.status))}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{t('releaseStepStateWaiting')}</span>
                )}
              </dd>
            </div>
          </dl>
          {frozen ? (
            <p className="text-xs text-muted-foreground">{t('releaseRoundProductionFrozen')}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {!frozen ? (
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  loading={production.confirming}
                  disabled={publishDisabled}
                  aria-describedby={publishDisabledReason ? 'production-publish-blocked' : undefined}
                  data-testid="workbench-production-action"
                  onClick={() => setConfirmOpen(true)}
                >
                  <RocketLaunch
                    size={15}
                    weight="bold"
                    aria-hidden="true"
                  />
                  {t('progressToProduction')}
                </Button>
                {publishDisabledReason ? (
                  <p
                    id="production-publish-blocked"
                    data-testid="production-publish-blocked-reason"
                    className="text-xs text-muted-foreground"
                  >
                    {publishDisabledReason}
                  </p>
                ) : null}
              </div>
            ) : null}
            <LinkButton
              variant="ghost"
              size="sm"
              href={props.environmentHref}
            >
              <ArrowUpRight
                size={14}
                aria-hidden="true"
              />
              {t('releaseRoundProductionGoEnv')}
            </LinkButton>
          </div>
        </>
      )}

      {props.productionRuns.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t('releaseProductionRunHistoryTitle')}</h4>
          <ReleaseProductionRunHistory
            runs={props.productionRuns}
            focusedRunId={props.focusedRunId}
            onOpenLog={props.onFocusRun}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('releaseProductionViewEmptyNeutral')}</p>
      )}

      <ProductionConfirmModal
        open={confirmOpen}
        loading={production.loading && !production.preview}
        confirming={production.confirming}
        error={production.errorKind === 'action' ? production.error : ''}
        loadError={production.errorKind === 'load' ? production.error : ''}
        preview={production.preview}
        onClose={() => setConfirmOpen(false)}
        onConfirm={production.confirm}
      />
      <ReleaseProductionRunLogDrawer
        run={focused}
        onClose={props.onCloseRunLog}
      />
    </section>
  );
}

function Fact(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className={`mt-0.5 truncate ${props.mono ? 'font-mono text-xs' : 'text-sm'}`}
        title={props.title ?? props.value}
      >
        {props.value}
      </dd>
    </div>
  );
}
