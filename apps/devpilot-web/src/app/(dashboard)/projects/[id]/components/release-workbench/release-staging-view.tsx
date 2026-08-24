/**
 * 环境发布链 · 预发节点视图：三步步骤条（右上角「发布」）+
 * 所选步骤的当前轮次内联面板 + 右侧轮次信息栏。
 */
'use client';

import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import type { ReleaseOrderWorkbenchNavigation } from '../../hooks/use-release-order-workbench-navigation';
import type { useReleaseGateCatalog } from '../../hooks/use-release-gate-catalog';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { buildReleaseOrderGateView } from '../release-order-gate-view.model';
import type { WorkbenchPublishState } from './release-workbench-actions.model';
import { ReleaseWorkbenchSteps } from './release-workbench-steps';
import { buildReleaseWorkbenchStepViews } from './release-workbench-steps.model';
import { ReleaseRoundPanel } from './release-round-panel';
import { ReleaseStepPreflightPanel } from './release-step-preflight-panel';
import { ReleaseStepBuildPanel } from './release-step-build-panel';
import { ReleaseStepDeployPanel } from './release-step-deploy-panel';
import { latestBuild, latestStagingDeployment } from './release-round.model';
import { ReleaseBuildLogLayer } from './release-build-log-layer';
import { ReleaseStagingLogLayer } from './release-staging-log-layer';

interface Props {
  projectId: string;
  releaseOrderId: string;
  detail: ReleaseOrderDetail;
  builds: ReleaseBuildsController;
  deployments: ReleaseStagingDeploymentsController;
  gateCatalog: ReturnType<typeof useReleaseGateCatalog>;
  buildGate: ReturnType<typeof buildReleaseOrderGateView>['build'];
  navigation: ReleaseOrderWorkbenchNavigation;
  publish: WorkbenchPublishState;
  publishTitle?: string;
  onPublish: () => void;
  onBuildLatest: () => void;
}

export function ReleaseStagingView(props: Props) {
  const { navigation, builds, deployments } = props;
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] xl:items-start">
      <ReleaseWorkbenchSteps
        views={buildReleaseWorkbenchStepViews(props.detail)}
        selectedStep={navigation.step}
        onSelectStep={navigation.selectStep}
        onPublish={props.onPublish}
        publishing={deployments.deploying}
        publishDisabled={props.publish.disabled}
        publishTitle={props.publishTitle}
      >
        {navigation.step === 'preflight' ? (
          <ReleaseStepPreflightPanel
            detail={props.detail}
            gateCatalog={props.gateCatalog}
          />
        ) : navigation.step === 'build' ? (
          <ReleaseStepBuildPanel
            build={latestBuild(builds.items)}
            building={builds.building}
            onOpenLog={navigation.openBuildLog}
          />
        ) : (
          <ReleaseStepDeployPanel
            deployment={latestStagingDeployment(deployments.items)}
            builds={builds.items}
            onOpenLog={navigation.openDeployLog}
          />
        )}
      </ReleaseWorkbenchSteps>
      <ReleaseRoundPanel
        latestBuild={latestBuild(builds.items)}
        latestDeployment={latestStagingDeployment(deployments.items)}
        builds={builds.items}
        building={builds.building}
        buildFrozen={props.detail.counts.releaseRuns > 0}
        buildGate={props.buildGate}
        /* PX-4：查看对应步骤详情时右栏压缩同名字段，避免 digest/Commit/时间与步骤详情重复。 */
        selectedStep={navigation.step}
        onBuildLatest={props.onBuildLatest}
        onOpenBuildHistory={navigation.openBuildHistory}
        onOpenDeployHistory={navigation.openDeployHistory}
        onOpenDeployLog={navigation.openDeployLog}
      />
      {/* 直接日志图层：裸聚焦（无 history）= 单层运行详情抽屉。 */}
      {navigation.history !== 'builds' ? (
        <ReleaseBuildLogLayer
          projectId={props.projectId}
          releaseOrderId={props.releaseOrderId}
          builds={builds}
          buildRunId={navigation.buildRunId}
          onClose={navigation.closeLog}
        />
      ) : null}
      {navigation.history !== 'deploys' ? (
        <ReleaseStagingLogLayer
          projectId={props.projectId}
          builds={builds}
          deployments={deployments}
          deploymentRunId={navigation.deploymentRunId}
          onClose={navigation.closeLog}
        />
      ) : null}
    </div>
  );
}
