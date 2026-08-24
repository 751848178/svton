/**
 * 步骤 03 内联面板 · 部署（仅当前轮次）：最新预发 DeploymentRun 的状态与验证结论。
 * 「查看日志」直接打开该运行的详情抽屉；全量历史经右侧部署信息卡进入。
 *
 * PX-4：Manifest Digest 统一短哈希；PX-20：日志入口统一「查看日志」+ 边框小按钮。
 */
'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { FlowStatusTag } from './release-flow-status-tag';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { releaseRunStatusLabelKey } from '../../utils/release-copy.model';
import { releaseOrderStatusTone } from '../../utils/release-order.utils';
import { shortDigest } from '../../utils/release-display.utils';
import {
  stagingBuildForRun,
  stagingBusinessConclusion,
  stagingTechnicalConclusion,
} from '../../utils/release-staging-view.model';
import { formatDuration, formatIso } from '../../utils/release-time.utils';

interface Props {
  deployment: ReleaseStagingDeploymentItem | null;
  builds: ReleaseBuildItem[];
  /** 直接打开当前轮次运行的日志详情抽屉（不经过历史列表）。 */
  onOpenLog: (runId: string) => void;
}

export function ReleaseStepDeployPanel(props: Props) {
  const t = useTranslations('projects');
  const deployment = props.deployment;

  if (!deployment) {
    return (
      <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        {t('releaseRoundNoDeploy')}
      </p>
    );
  }

  const build = stagingBuildForRun(deployment, props.builds);
  const technical = stagingTechnicalConclusion(deployment);
  const business = stagingBusinessConclusion(deployment);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FlowStatusTag
          status={releaseOrderStatusTone(deployment.status)}
          label={t(releaseRunStatusLabelKey(deployment.status))}
        />
        <span className="text-xs text-muted-foreground">
          {formatDuration(deployment.startedAt, deployment.finishedAt) ||
            t('releaseWorkbenchValueEmpty')} ·{' '}
          {formatIso(deployment.startedAt)}
        </span>
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          onClick={() => props.onOpenLog(deployment.id)}
        >
          {t('viewReleaseLogs')}
        </Button>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{t('releaseStagingTechnicalResult')}</dt>
          <dd className="mt-1">
            <FlowStatusTag
              status={technical.tone}
              label={t(technical.key)}
            />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{t('releaseStagingBusinessResult')}</dt>
          <dd className="mt-1">
            <FlowStatusTag
              status={business.tone}
              label={t(business.key)}
            />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{t('releaseBuildManifestDigest')}</dt>
          <dd
            className="mt-1 truncate font-mono text-xs"
            title={build?.manifest?.digest || deployment.artifactManifestId || t('releaseWorkbenchValueEmpty')}
          >
            {shortDigest(build?.manifest?.digest || deployment.artifactManifestId)}
          </dd>
        </div>
      </dl>
      {deployment.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {deployment.error}
        </p>
      ) : null}
    </div>
  );
}
