'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { FlowStatusTag } from './release-flow-status-tag';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderEvidence } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { releaseOrderStatusLabelKey } from '../../utils/release-copy.model';
import { releaseOrderStatusTone } from '../../utils/release-order.utils';
import { releaseVersionIdentity } from '../../utils/release-version-display.model';
import { latestReleaseManifest, latestReleaseRunAt } from './release-workbench-summary.model';

interface Props {
  detail: ReleaseOrderDetail;
  projectSummary?: ProjectDeliverySummary;
  evidence: ReleaseOrderEvidence | null;
  /** 页面标题正下方的预警条（当前决策/门禁结论）。 */
  alert?: ReactNode;
  onBack: () => void;
}

export function ReleaseWorkbenchHeader(props: Props) {
  const t = useTranslations('projects');
  const { detail } = props;
  const manifest = latestReleaseManifest(props.evidence);
  const branch = manifest?.buildRun.sourceBranch || detail.preflight.repository.branch;
  const commit = manifest?.buildRun.sourceCommitSha;
  const staging = props.projectSummary?.currentVersions.staging?.releaseVersion;
  const production = props.projectSummary?.currentVersions.production?.releaseVersion;
  const identity = releaseVersionIdentity(detail.releaseVersion, detail.releaseName);
  const latestRunAt = latestReleaseRunAt(props.evidence);

  return (
    <header className="space-y-4 border-b border-border pb-5">
      {/* 发布详情独立页头：← 返回箭头 + 发布单名称/状态即标题；
          项目名 eyebrow 移除（全局面包屑已承载项目层级）。
          PX-17：标题用 H1，下级标题顺移（h2 步骤区 / h3 信息卡）。 */}
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 shrink-0"
          aria-label={t('backToReleaseOrders')}
          onClick={props.onBack}
        >
          <span aria-hidden="true">←</span>
        </Button>
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.4px]">
            {identity.name ||
              (identity.canonical ? identity.version : t('releaseLegacyNameFallback'))}
          </h1>
          <FlowStatusTag
            status={releaseOrderStatusTone(detail.lifecycle.status)}
            label={t(releaseOrderStatusLabelKey(detail.lifecycle.status))}
          />
        </div>
      </div>

      {/* 预警条紧跟页面标题：先看结论与阻断，再看基础信息。 */}
      {props.alert ? props.alert : null}

      {/* 基本信息行：note 仅在存在时占据左侧，避免空 flex 容器把
          版本号等事实整体推到右侧（对齐缺陷）。 */}
      {detail.note ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <p className="min-w-0 max-w-2xl text-sm text-muted-foreground">{detail.note}</p>
          <ReleaseWorkbenchFacts
            identity={identity}
            branch={branch}
            commit={commit}
            staging={staging}
            production={production}
            latestRunAt={latestRunAt}
          />
        </div>
      ) : (
        <ReleaseWorkbenchFacts
          identity={identity}
          branch={branch}
          commit={commit}
          staging={staging}
          production={production}
          latestRunAt={latestRunAt}
        />
      )}
    </header>
  );
}

/**
 * PX-29/PX-37 meta 行瘦身：去掉与标题徽章逐字重复的「真实执行阶段」，
 * 环境版本拆为两行（1280 下不再截断成「Producti…」）。
 */
function ReleaseWorkbenchFacts(props: {
  identity: ReturnType<typeof releaseVersionIdentity>;
  branch: string | null | undefined;
  commit: string | undefined;
  staging?: string;
  production?: string;
  latestRunAt: string | null;
}) {
  const t = useTranslations('projects');
  const { identity } = props;
  return (
    <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
      <HeaderFact
        label={t('releaseVersionLabel')}
        value={
          identity.canonical
            ? identity.version
            : t('releaseLegacyVersionValue', { version: identity.version })
        }
      />
      <HeaderFact
        label={t('releaseWorkbenchSource')}
        value={sourceLabel(props.branch, props.commit, t('releaseWorkbenchCommitPending'))}
        mono
      />
      <div className="min-w-0">
        <span className="block text-xs text-muted-foreground">
          {t('releaseWorkbenchEnvironmentVersions')}
        </span>
        <div className="mt-0.5">
          <strong
            className="block truncate font-medium"
            title={t('releaseWorkbenchStagingVersion', {
              version: props.staging || t('releaseWorkbenchNoCurrentVersion'),
            })}
          >
            {t('releaseWorkbenchStagingVersion', {
              version: props.staging || t('releaseWorkbenchNoCurrentVersion'),
            })}
          </strong>
          <strong
            className="block truncate font-medium"
            title={t('releaseWorkbenchProductionVersion', {
              version: props.production || t('releaseWorkbenchNoCurrentVersion'),
            })}
          >
            {t('releaseWorkbenchProductionVersion', {
              version: props.production || t('releaseWorkbenchNoCurrentVersion'),
            })}
          </strong>
        </div>
      </div>
      <HeaderFact
        label={t('releaseWorkbenchLatestRun')}
        value={props.latestRunAt ? formatDateTimeMinute(props.latestRunAt) : t('releaseWorkbenchNoRunYet')}
      />
    </div>
  );
}

function HeaderFact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="block text-xs text-muted-foreground">{props.label}</span>
      <strong
        className={`mt-0.5 block truncate font-medium ${props.mono ? 'font-mono text-xs' : ''}`}
        title={props.value}
      >
        {props.value}
      </strong>
    </div>
  );
}

function sourceLabel(
  branch: string | null | undefined,
  commit: string | undefined,
  fallback: string,
) {
  const sourceBranch = branch || '—';
  return commit ? `${sourceBranch} @ ${commit.slice(0, 8)}` : `${sourceBranch} · ${fallback}`;
}
