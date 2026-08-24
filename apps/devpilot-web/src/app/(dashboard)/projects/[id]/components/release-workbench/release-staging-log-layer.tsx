/**
 * 预发部署运行日志图层（单一职责：聚焦 DeploymentRun → 日志详情抽屉）。
 * 直接模式（步骤内联面板「日志」）与部署历史抽屉内的二层日志共用本图层。
 */
'use client';

import { useEffect, useRef } from 'react';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import { stagingBuildForRun } from '../../utils/release-staging-view.model';
import { ReleaseStagingLogDrawer } from '../release-staging-log-drawer';

interface Props {
  projectId: string;
  builds: ReleaseBuildsController;
  deployments: ReleaseStagingDeploymentsController;
  /** 聚焦的 DeploymentRun；空表示图层关闭。 */
  deploymentRunId?: string;
  onClose: () => void;
}

export function ReleaseStagingLogLayer(props: Props) {
  const { deployments, deploymentRunId, onClose } = props;
  const run = deployments.items.find((item) => item.id === deploymentRunId) || null;
  const build = run ? stagingBuildForRun(run, props.builds.items) : null;
  const normalized = useRef<string | null>(null);

  useEffect(() => {
    if (!deploymentRunId || run || deployments.error) {
      normalized.current = null;
      return;
    }
    if (
      !deployments.loadedSuccessfully ||
      deployments.loading ||
      normalized.current === deploymentRunId
    )
      return;
    normalized.current = deploymentRunId;
    onClose();
  }, [deploymentRunId, deployments.error, deployments.loadedSuccessfully, deployments.loading, onClose, run]);

  return (
    <ReleaseStagingLogDrawer
      projectId={props.projectId}
      run={run}
      build={build}
      requestedRunId={deploymentRunId}
      loading={Boolean(deploymentRunId) && deployments.loading}
      error={deployments.error}
      onRetry={deployments.load}
      onClose={onClose}
    />
  );
}
