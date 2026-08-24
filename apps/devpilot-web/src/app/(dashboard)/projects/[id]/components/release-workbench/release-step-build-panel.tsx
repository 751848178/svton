/**
 * 步骤 02 内联面板 · 构建（仅当前轮次）：最新 BuildRun 的状态与证据。
 * 「查看日志」直接打开该运行的详情抽屉；全量历史经右侧构建信息卡进入。
 *
 * PX-4：Manifest Digest 全场统一短哈希（完整值进 title）。
 * PX-27：非表格空态统一「暂无」（表格保留「—」）。
 * PX-32：错误枚举映射中文标题，字节数人性化。
 */
'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import {
  buildErrorText,
  shortDigest,
} from '../../utils/release-display.utils';
import {
  releaseBuildStatusLabelKey,
  releaseBuildStatusTone,
} from '../release-build-view.model';
import { formatDuration, formatIso } from '../../utils/release-time.utils';

interface Props {
  build: ReleaseBuildItem | null;
  building: boolean;
  /** 直接打开当前轮次运行的日志详情抽屉（不经过历史列表）。 */
  onOpenLog: (runId: string) => void;
}

export function ReleaseStepBuildPanel(props: Props) {
  const t = useTranslations('projects');
  const build = props.build;

  if (!build) {
    return (
      <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        {t('releaseRoundNoBuild')}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FlowStatusTag
          status={releaseBuildStatusTone(build.status)}
          label={t(releaseBuildStatusLabelKey(build.status))}
        />
        <span className="text-xs text-muted-foreground">
          {t('releaseBuildRevision', { revision: build.revision })} ·{' '}
          {formatDuration(build.startedAt, build.finishedAt) || t('releaseWorkbenchValueEmpty')} ·{' '}
          {formatIso(build.createdAt)}
        </span>
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          loading={props.building}
          onClick={() => props.onOpenLog(build.id)}
        >
          {t('viewReleaseLogs')}
        </Button>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <Fact
          label={t('releaseBuildCommit')}
          value={`${build.sourceBranch} @ ${build.sourceCommitSha.slice(0, 12)}`}
          mono
        />
        <Fact
          label={t('releaseBuildManifestDigest')}
          value={shortDigest(build.manifest?.digest)}
          title={build.manifest?.digest}
          mono
        />
        <Fact
          label={t('releaseBuildLogReference')}
          value={build.logReference || t('releaseWorkbenchValueEmpty')}
          mono
        />
      </dl>
      {build.errorCode ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          title={`${build.errorCode}: ${build.errorMessage || t('releaseBuildUnavailable')}`}
        >
          {buildErrorText(build.errorCode, build.errorMessage, t('releaseBuildUnavailable'))}
        </p>
      ) : null}
    </div>
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
