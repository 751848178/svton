/**
 * 步骤 02 内联面板 · 构建（仅当前轮次）：最新 BuildRun 的状态与证据。
 * 「查看日志」直接打开该运行的详情抽屉；全量历史经右侧构建信息卡进入。
 *
 * 人看主层只保留结论与精确 Commit；Manifest Digest、日志引用等
 * 机器证据统一收进日志详情抽屉（关键事实 / 技术详情两层）。
 * PX-27：非表格空态统一「暂无」（表格保留「—」）。
 * PX-32：错误枚举映射中文标题，字节数人性化。
 */
'use client';

import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import { buildErrorText } from '../../utils/release-display.utils';
import { ReleaseBuildCurrentSummary } from './release-build-current-summary';
import { ReleaseBuildResources } from './release-build-resources';

interface Props {
  build: ReleaseBuildItem | null;
  building: boolean;
  evidenceLoading?: boolean;
  evidenceError?: string;
  onRetryEvidence?: () => void;
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
    <div className="space-y-4">
      <ReleaseBuildCurrentSummary
        build={build}
        building={props.building}
        manifestItemsLoaded={!props.evidenceLoading && !props.evidenceError}
        onOpenLog={props.onOpenLog}
      />
      {props.evidenceError ? (
        <ErrorBanner
          message={props.evidenceError}
          onRetry={props.onRetryEvidence}
        />
      ) : null}
      {props.evidenceLoading ? <LoadingState text={t('releaseBuildDetailLoading')} /> : null}
      {!props.evidenceLoading && !props.evidenceError && build.manifest ? (
        <ReleaseBuildResources items={build.manifest.items} />
      ) : null}
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
