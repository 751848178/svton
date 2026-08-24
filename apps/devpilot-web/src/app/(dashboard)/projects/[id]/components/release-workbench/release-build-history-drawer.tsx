/**
 * 构建历史抽屉：当前发布单全部 BuildRun；行内「日志」打开二层日志抽屉
 * （聚焦逻辑由 release-build-log-layer 统一承载）。
 */
'use client';

import { useTranslations } from 'next-intl';
import { Drawer, LoadingState } from '@svton/ui';
import { EmptyState, ErrorBanner } from '@/components/ui';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import { ReleaseBuildHistoryTable } from '../release-build-history-table';
import { ReleaseBuildLogLayer } from './release-build-log-layer';

interface Props {
  open: boolean;
  projectId: string;
  releaseOrderId: string;
  builds: ReleaseBuildsController;
  focusedBuildRunId?: string;
  onOpenLog: (buildRunId: string) => void;
  onCloseLog: () => void;
  onClose: () => void;
}

export function ReleaseBuildHistoryDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const { builds } = props;
  const items = builds.items.filter((item) => item.releaseOrderId === props.releaseOrderId);

  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      title={t('releaseWorkbenchBuildDrawerTitle')}
      description={t('releaseStepBuildDescription')}
      width="min(800px, 100vw)"
      ariaCloseLabel={tc('close')}
    >
      <div className="space-y-4">
        {builds.error ? (
          <ErrorBanner
            message={builds.error}
            onRetry={builds.load}
          />
        ) : null}
        {builds.loading && items.length === 0 ? (
          <LoadingState text={t('releaseBuildLoading')} />
        ) : null}
        {builds.loadedSuccessfully && !builds.loading && items.length === 0 ? (
          <EmptyState title={t('releaseBuildEmpty')} />
        ) : null}
        {items.length > 0 ? (
          <>
            {builds.total > items.length ? (
              <p className="text-xs text-muted-foreground">
                {t('releaseBuildHistoryLimited', { shown: items.length, total: builds.total })}
              </p>
            ) : null}
            <ReleaseBuildHistoryTable
              items={items}
              onOpenLog={props.onOpenLog}
            />
          </>
        ) : null}
        <ReleaseBuildLogLayer
          projectId={props.projectId}
          releaseOrderId={props.releaseOrderId}
          builds={builds}
          buildRunId={props.focusedBuildRunId}
          onClose={props.onCloseLog}
        />
      </div>
    </Drawer>
  );
}
