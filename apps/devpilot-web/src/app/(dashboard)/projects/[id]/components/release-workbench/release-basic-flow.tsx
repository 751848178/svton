'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseOrderWorkbenchNavigation } from '../../hooks/use-release-order-workbench-navigation';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { buildReleaseOrderGateView } from '../release-order-gate-view.model';
import { PROJECT_SURFACE_SHADOW } from '../project-workbench-surface';
import {
  basicReleaseStageViews,
  type BasicReleaseStage,
  type BasicReleaseStep,
} from './release-basic-flow.model';
import { BasicReleaseRail } from './release-basic-rail';
import { ReleaseBasicProductionStage } from './release-basic-production-stage';
import { ReleaseBasicStagingStage } from './release-basic-staging-stage';
import { ReleaseBasicSubsteps } from './release-basic-substeps';
import {
  latestBuild,
  latestProductionRun,
  latestStagingDeployment,
  latestSuccessfulManifestBuild,
  productionManifestBuild,
} from './release-round.model';

interface Props {
  projectId: string;
  releaseOrderId: string;
  detail: ReleaseOrderDetail;
  projectSummary?: ProjectDeliverySummary;
  builds: ReleaseBuildsController;
  deployments: ReleaseStagingDeploymentsController;
  productionRuns: ReleaseEvidenceProductionRun[];
  gateView: ReturnType<typeof buildReleaseOrderGateView>;
  navigation: ReleaseOrderWorkbenchNavigation;
  onBuildLatest: () => void;
  onRefresh: () => Promise<unknown>;
}

export function ReleaseBasicFlow(props: Props) {
  const t = useTranslations('projects');
  const build = latestBuild(props.builds.items);
  const deployableBuild = latestSuccessfulManifestBuild(props.builds.items);
  const deployment = latestStagingDeployment(props.deployments.items);
  const productionRun = latestProductionRun(props.productionRuns);
  const manifestBuild = productionManifestBuild({
    productionRuns: props.productionRuns,
    stagingRuns: props.deployments.items,
    builds: props.builds.items,
  });
  const stages = basicReleaseStageViews({
    latestBuild: build,
    deployableBuild,
    latestDeployment: deployment,
    latestProductionRun: productionRun,
    building: props.builds.building,
    deploying: props.deployments.deploying,
  });
  const requestedStage = props.navigation.release as BasicReleaseStage;
  const activeStage =
    stages.find((stage) => stage.key === requestedStage && stage.state !== 'disabled') ?? stages[0];
  const requestedStep = navigationStep(activeStage.key, props.navigation.step);
  const activeStep =
    activeStage.steps.find((step) => step.key === requestedStep && step.state !== 'disabled') ??
    activeStage.steps.find((step) => ['current', 'available'].includes(step.state)) ??
    activeStage.steps[0];
  const hasSubstepNavigation = activeStage.steps.length > 1;

  const selectStage = (stage: BasicReleaseStage) => {
    const target = stages.find((item) => item.key === stage);
    if (!target || target.state === 'disabled') return;
    props.navigation.selectRelease(stage);
  };
  const selectStep = (step: BasicReleaseStep) => {
    if (step === 'build') props.navigation.selectStep('build');
    if (step === 'stagingDeploy') props.navigation.selectStep('staging');
    if (step === 'productionDeploy') props.navigation.selectRelease('production');
  };

  return (
    <div className="space-y-3">
      <BasicReleaseRail
        stages={stages}
        selected={activeStage.key}
        onSelect={selectStage}
      />
      <section
        id={`basic-release-stage-panel-${activeStage.key}`}
        role="tabpanel"
        aria-labelledby={`basic-release-stage-tab-${activeStage.key}`}
        className={`rounded-xl border bg-white p-5 sm:p-6 ${PROJECT_SURFACE_SHADOW}`}
      >
        <div
          className={`${hasSubstepNavigation ? 'mb-5' : ''} flex flex-wrap items-start justify-between gap-3`}
        >
          <div>
            <h2 className="text-base font-semibold">{t(activeStage.labelKey)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(activeStage.descriptionKey)}</p>
          </div>
          <span className="text-xs font-semibold text-primary">
            {t('releaseLifecycleStepProgress', {
              done: activeStage.steps.filter((step) => step.state === 'done').length,
              total: activeStage.steps.length,
            })}
          </span>
        </div>
        {hasSubstepNavigation ? (
          <ReleaseBasicSubsteps
            steps={activeStage.steps}
            selected={activeStep.key}
            onSelect={selectStep}
          />
        ) : null}
        <div
          {...(hasSubstepNavigation
            ? {
                id: `basic-release-step-panel-${activeStep.key}`,
                role: 'tabpanel',
                'aria-labelledby': `basic-release-step-tab-${activeStep.key}`,
                tabIndex: 0,
              }
            : {})}
          className={`${hasSubstepNavigation ? 'mt-6' : ''} border-t pt-5`}
        >
          {activeStage.key === 'staging' ? (
            <ReleaseBasicStagingStage
              {...props}
              activeStep={activeStep.key === 'build' ? 'build' : 'stagingDeploy'}
              onOpenBuildLog={props.navigation.openBuildLog}
              onOpenDeployLog={props.navigation.openDeployLog}
            />
          ) : (
            <ReleaseBasicProductionStage
              projectId={props.projectId}
              releaseOrderId={props.releaseOrderId}
              manifestBuild={manifestBuild}
              stagingDeployment={deployment}
              productionRuns={props.productionRuns}
              onChanged={props.onRefresh}
              onOpenLog={props.navigation.openProductionLog}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function navigationStep(stage: BasicReleaseStage, step: ReleaseOrderDetail['resumeStep']) {
  if (stage === 'production') return 'productionDeploy';
  return step === 'build' || step === 'preflight' ? 'build' : 'stagingDeploy';
}
