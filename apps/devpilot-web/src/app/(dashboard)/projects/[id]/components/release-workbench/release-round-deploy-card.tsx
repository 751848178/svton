/**
 * 右侧轮次信息卡 · 部署信息：当前轮次预发部署快照 + 验证结论 + 历史入口。
 *
 * PX-4：查看步骤 03（部署）详情时压缩同名字段（摘要/时间/技术部署已由步骤详情承载）。
 * PX-14：字段值统一 13px/500。
 * PX-20：日志入口统一为「查看日志」+ 边框小按钮形态。
 */
'use client';

import { ClockCounterClockwise } from '@phosphor-icons/react';
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
import { stagingBuildForRun, stagingTechnicalConclusion } from '../../utils/release-staging-view.model';
import { formatDuration, formatIso } from '../../utils/release-time.utils';

interface Props {
  deployment: ReleaseStagingDeploymentItem | null;
  builds: ReleaseBuildItem[];
  compact?: boolean;
  onOpenHistory: () => void;
  onOpenLatestLog?: (runId: string) => void;
}

export function ReleaseRoundDeployCard(props: Props) {
  const t = useTranslations('projects');
  const deployment = props.deployment;
  const build = deployment ? stagingBuildForRun(deployment, props.builds) : null;
  const verification = deployment ? stagingTechnicalConclusion(deployment) : null;

  return (
    <section
      className="border-b border-border px-4 py-4 xl:pl-5 xl:pr-4"
      aria-labelledby="release-round-deploy-title"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="release-round-deploy-title"
          className="text-sm font-semibold"
        >
          {t('releaseRoundDeployTitle')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onOpenHistory}
        >
          <ClockCounterClockwise
            size={14}
            aria-hidden="true"
          />
          {t('releaseRoundViewHistory')}
        </Button>
      </div>
      {deployment ? (
        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <FlowStatusTag
              status={releaseOrderStatusTone(deployment.status)}
              label={t(releaseRunStatusLabelKey(deployment.status))}
            />
            <span className="text-muted-foreground">
              {formatDuration(deployment.startedAt, deployment.finishedAt) ||
                t('releaseWorkbenchValueEmpty')}
            </span>
          </div>
          {props.compact ? null : (
            <>
              {verification ? (
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">
                    {t('releaseStagingTechnicalResult')}
                  </dt>
                  <dd>
                    <FlowStatusTag
                      status={verification.tone}
                      label={t(verification.key)}
                    />
                  </dd>
                </div>
              ) : null}
              <Fact
                label={t('releaseBuildManifestDigest')}
                value={shortDigest(build?.manifest?.digest || deployment.artifactManifestId)}
                title={build?.manifest?.digest || deployment.artifactManifestId || undefined}
                mono
              />
              <Fact
                label={t('releaseBuildStartedAt')}
                value={formatIso(deployment.startedAt)}
              />
            </>
          )}
          {props.onOpenLatestLog ? (
            <dd className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => props.onOpenLatestLog?.(deployment.id)}
              >
                {t('viewReleaseLogs')}
              </Button>
            </dd>
          ) : null}
        </dl>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t('releaseRoundNoDeploy')}</p>
      )}
    </section>
  );
}

function Fact(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{props.label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-[13px] font-medium ${
          props.mono ? 'font-mono text-xs' : ''
        }`}
        title={props.title ?? props.value}
      >
        {props.value}
      </dd>
    </div>
  );
}
