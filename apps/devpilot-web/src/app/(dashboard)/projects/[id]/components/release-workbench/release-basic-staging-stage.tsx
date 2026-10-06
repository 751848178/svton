'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { isReleaseStagingActive } from '../../utils/release-staging-view.model';
import type { buildReleaseOrderGateView } from '../release-order-gate-view.model';
import { workbenchPublishState } from './release-workbench-actions.model';
import {
  ReleaseBuildActionBar,
  ReleasePublishActionBar,
} from './release-lifecycle-step-action-bar';
import { ReleaseBasicBuildPanel } from './release-basic-build-panel';
import type { BasicReleaseStep } from './release-basic-flow.model';
import { ReleaseStepDeployPanel } from './release-step-deploy-panel';
import {
  latestBuild,
  latestStagingDeployment,
  latestSuccessfulManifestBuild,
} from './release-round.model';

interface Props {
  activeStep: Extract<BasicReleaseStep, 'build' | 'stagingDeploy'>;
  detail: ReleaseOrderDetail;
  projectSummary?: ProjectDeliverySummary;
  builds: ReleaseBuildsController;
  deployments: ReleaseStagingDeploymentsController;
  gateView: ReturnType<typeof buildReleaseOrderGateView>;
  onBuildLatest: () => void;
  onOpenBuildLog: (runId: string) => void;
  onOpenDeployLog: (runId: string) => void;
}

export function ReleaseBasicStagingStage(props: Props) {
  const t = useTranslations('projects');
  const build = latestBuild(props.builds.items);
  const deployableBuild = latestSuccessfulManifestBuild(props.builds.items);
  const deployment = latestStagingDeployment(props.deployments.items);
  const deploymentCompleted = Boolean(
    deployment && ['completed', 'succeeded'].includes(deployment.status.toLowerCase()),
  );
  const deploymentActive = Boolean(deployment && isReleaseStagingActive(deployment.status));
  const deploying = props.deployments.deploying || deploymentActive;
  const publish = workbenchPublishState({
    deployableBuild,
    stagingGate: props.gateView.staging,
    deploying,
  });
  const publishReason = publish.noManifest
    ? t('releaseWorkbenchPublishDisabledNoManifest')
    : publish.blockedByGate
      ? props.gateView.staging.reason
      : undefined;
  const repairHref =
    publish.blockedByGate && props.gateView.staging.repairArea === 'targets'
      ? props.gateView.stagingHref
      : undefined;
  const deploy = () => {
    const manifestId = deployableBuild?.manifest?.id;
    if (publish.disabled || deploymentCompleted || !manifestId) return;
    void props.deployments.deploy(manifestId);
  };

  if (props.activeStep === 'build') {
    return (
      <>
        <ReleaseBuildActionBar
          basic
          hasBuild={Boolean(build)}
          building={props.builds.building}
          frozen={props.detail.counts.releaseRuns > 0}
          allowed={props.gateView.build.allowed}
          blockedReason={props.gateView.build.reason}
          onBuildLatest={props.onBuildLatest}
        />
        <ReleaseBasicBuildPanel
          build={build}
          building={props.builds.building}
          onOpenLog={props.onOpenBuildLog}
        />
      </>
    );
  }
  return (
    <>
      <ReleasePublishActionBar
        basic
        deploying={deploying}
        completed={deploymentCompleted}
        disabled={publish.disabled || deploymentCompleted}
        disabledReason={publishReason}
        repairHref={repairHref}
        onPublish={deploy}
      />
      <ReleaseStepDeployPanel
        basic
        deployment={deployment}
        builds={props.builds.items}
        stagingEnvironment={props.projectSummary?.baselines.staging}
        showEvidenceHint={false}
        onOpenLog={props.onOpenDeployLog}
      />
    </>
  );
}
