/**
 * 构建运行日志图层（单一职责：聚焦 BuildRun → 日志详情抽屉）。
 * 直接模式（步骤内联面板「日志」）与构建历史抽屉内的二层日志共用本图层。
 */
'use client';

import { useEffect, useRef } from 'react';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import { useReleaseBuildDetail } from '../../hooks/use-release-build-detail';
import { ReleaseBuildLogDrawer } from '../release-build-log-drawer';

interface Props {
  projectId: string;
  releaseOrderId: string;
  builds: ReleaseBuildsController;
  /** 聚焦的 BuildRun；空表示图层关闭。 */
  buildRunId?: string;
  onClose: () => void;
}

export function ReleaseBuildLogLayer(props: Props) {
  const { builds } = props;
  const items = builds.items.filter((item) => item.releaseOrderId === props.releaseOrderId);
  const summary = items.find((item) => item.id === props.buildRunId) || null;
  const detail = useReleaseBuildDetail(
    props.projectId,
    props.releaseOrderId,
    props.buildRunId,
    summary,
  );
  const normalized = useRef<string | null>(null);
  const { buildRunId, onClose } = props;

  // 列表已确认不存在该运行时收起聚焦（防死链）。
  useEffect(() => {
    if (!buildRunId || detail.run || detail.error) {
      normalized.current = null;
      return;
    }
    if (!builds.loadedSuccessfully || !detail.notFound || normalized.current === buildRunId) return;
    normalized.current = buildRunId;
    onClose();
  }, [buildRunId, builds.loadedSuccessfully, detail.error, detail.notFound, detail.run, onClose]);

  return (
    <ReleaseBuildLogDrawer
      run={detail.run}
      requestedBuildRunId={buildRunId}
      loading={Boolean(buildRunId) && !detail.loaded}
      error={detail.error}
      onRetry={detail.retry}
      onClose={onClose}
    />
  );
}
