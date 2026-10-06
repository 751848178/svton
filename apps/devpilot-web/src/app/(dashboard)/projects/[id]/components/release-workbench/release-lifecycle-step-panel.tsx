'use client';

import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import type { ReleaseOrderWorkbenchNavigation } from '../../hooks/use-release-order-workbench-navigation';
import type { useReleaseGateCatalog } from '../../hooks/use-release-gate-catalog';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { buildReleaseOrderGateView } from '../release-order-gate-view.model';
import type { WorkbenchPublishState } from './release-workbench-actions.model';
import {
  ReleaseBuildActionBar,
  ReleasePublishActionBar,
} from './release-lifecycle-step-action-bar';
import type { ReleaseLifecycleStep } from './release-lifecycle.model';
import { latestBuild, latestStagingDeployment } from './release-round.model';
import { ReleaseStepBuildLayer } from './release-step-build-layer';
import { ReleaseStepDeployPanel } from './release-step-deploy-panel';
import { ReleaseStepPreflightPanel } from './release-step-preflight-panel';
import { ReleaseStepStagingValidationPanel } from './release-step-staging-validation-panel';

interface Props {
  projectId: string;
  releaseOrderId: string;
  selected: ReleaseLifecycleStep;
  detail: ReleaseOrderDetail;
  projectSummary?: ProjectDeliverySummary;
  builds: ReleaseBuildsController;
  deployments: ReleaseStagingDeploymentsController;
  gateCatalog: ReturnType<typeof useReleaseGateCatalog>;
  buildGate: ReturnType<typeof buildReleaseOrderGateView>['build'];
  navigation: ReleaseOrderWorkbenchNavigation;
  publish: WorkbenchPublishState;
  publishTitle?: string;
  publishRepairHref?: string;
  onPublish: () => void;
  onBuildLatest: () => void;
}

export function ReleaseLifecycleStepPanel(props: Props) {
  const build = latestBuild(props.builds.items);
  const latest = latestStagingDeployment(props.deployments.items);
  if (props.selected === 'preflight') {
    return (
      <ReleaseStepPreflightPanel
        projectId={props.projectId}
        detail={props.detail}
        gateCatalog={props.gateCatalog}
      />
    );
  }
  if (props.selected === 'build') {
    return (
      <div className="space-y-4">
        <ReleaseBuildActionBar
          hasBuild={Boolean(build)}
          building={props.builds.building}
          frozen={props.detail.counts.releaseRuns > 0}
          allowed={props.buildGate.allowed}
          blockedReason={props.buildGate.reason}
          onOpenHistory={props.navigation.openBuildHistory}
          onBuildLatest={props.onBuildLatest}
        />
        {build ? (
          <ReleaseStepBuildLayer
            projectId={props.projectId}
            releaseOrderId={props.releaseOrderId}
            build={build}
            building={props.builds.building}
            onOpenLog={props.navigation.openBuildLog}
          />
        ) : null}
      </div>
    );
  }
  if (props.selected === 'stagingValidation') {
    return (
      <ReleaseStepStagingValidationPanel
        deployment={latest}
        onOpenEvidence={props.navigation.openDeployEvidence}
      />
    );
  }
  return (
    <div className="space-y-4">
      <ReleasePublishActionBar
        deploying={props.deployments.deploying}
        disabled={props.publish.disabled}
        disabledReason={props.publishTitle}
        repairHref={props.publishRepairHref}
        onOpenHistory={props.navigation.openDeployHistory}
        onPublish={props.onPublish}
      />
      <ReleaseStepDeployPanel
        deployment={latest}
        builds={props.builds.items}
        stagingEnvironment={props.projectSummary?.baselines.staging ?? null}
        onOpenLog={props.navigation.openDeployLog}
      />
    </div>
  );
}
