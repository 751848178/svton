'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import type { ReleaseOrderWorkbenchNavigation } from '../../hooks/use-release-order-workbench-navigation';
import type { useReleaseGateCatalog } from '../../hooks/use-release-gate-catalog';
import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../../types/release-order-evidence.types';
import type { ReleaseBuildItem, ReleaseOrderDetail } from '../../types/release-order.types';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { buildReleaseOrderGateView } from '../release-order-gate-view.model';
import { PROJECT_SURFACE_SHADOW } from '../project-workbench-surface';
import type { WorkbenchPublishState } from './release-workbench-actions.model';
import { ReleaseBuildLogLayer } from './release-build-log-layer';
import { ReleaseLifecycleActivePanel } from './release-lifecycle-active-panel';
import {
  releaseLifecycleStagePanelId,
  releaseLifecycleStageTabId,
  releaseLifecycleStepPanelId,
  releaseLifecycleStepTabId,
} from './release-lifecycle-dom.model';
import {
  buildReleaseLifecycleViews,
  type ReleaseLifecycleStage,
  type ReleaseLifecycleStep,
} from './release-lifecycle.model';
import { ReleaseLifecycleRail } from './release-lifecycle-rail';
import { ReleaseLifecycleSubsteps } from './release-lifecycle-substeps';
import { ReleaseStagingLogLayer } from './release-staging-log-layer';
import type { ReleaseStagingValidationEvidence } from '../../utils/release-staging-view.model';
import { buildReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';

interface Props {
  projectId: string;
  releaseOrderId: string;
  detail: ReleaseOrderDetail;
  projectSummary?: ProjectDeliverySummary;
  builds: ReleaseBuildsController;
  deployments: ReleaseStagingDeploymentsController;
  productionRuns: ReleaseEvidenceProductionRun[];
  stagingEvidenceRuns: ReleaseEvidenceDeploymentRun[];
  stagingProof: ReleaseStagingValidationEvidence | null;
  manifestBuild: ReleaseBuildItem | null;
  gateCatalog: ReturnType<typeof useReleaseGateCatalog>;
  buildGate: ReturnType<typeof buildReleaseOrderGateView>['build'];
  navigation: ReleaseOrderWorkbenchNavigation;
  decisionStep: ReleaseOrderDetail['resumeStep'];
  decisionAlert: ReactNode;
  publish: WorkbenchPublishState;
  publishTitle?: string;
  publishRepairHref?: string;
  onPublish: () => void;
  onBuildLatest: () => void;
  onRefresh: () => Promise<unknown>;
}

export function ReleaseLifecycleContent(props: Props) {
  const t = useTranslations('projects');
  const lifecycleEvidence = useMemo(
    () =>
      buildReleaseLifecycleEvidence({
        detail: props.detail,
        stagingRuns: props.stagingEvidenceRuns,
        productionRuns: props.productionRuns,
        currentProductionVersion: props.projectSummary?.currentVersions.production,
      }),
    [props.detail, props.productionRuns, props.projectSummary, props.stagingEvidenceRuns],
  );
  const stages = useMemo(
    () =>
      buildReleaseLifecycleViews({
        detail: props.detail,
        evidence: lifecycleEvidence,
      }),
    [lifecycleEvidence, props.detail],
  );
  const [selectedStage, setSelectedStage] = useState<ReleaseLifecycleStage>(
    props.navigation.release,
  );
  const [selectedStep, setSelectedStep] = useState<ReleaseLifecycleStep>(() =>
    stagingNavigationStep(props.navigation.step, props.navigation.stagingStep),
  );
  const activeStage =
    stages.find((stage) => stage.key === selectedStage && stage.state !== 'disabled') ?? stages[0];
  const activeStep =
    activeStage.steps.find((step) => step.key === selectedStep && step.state !== 'disabled') ??
    activeStage.steps.find((step) => ['current', 'available'].includes(step.state)) ??
    activeStage.steps[0];

  const selectStage = (stage: ReleaseLifecycleStage) => {
    const target = stages.find((item) => item.key === stage);
    if (!target || target.state === 'disabled') return;
    setSelectedStage(stage);
    setSelectedStep(
      target.steps.find((step) => ['current', 'available'].includes(step.state))?.key ??
        target.steps[0].key,
    );
    if (stage === 'staging' || stage === 'production') props.navigation.selectRelease(stage);
  };

  const selectStep = (step: ReleaseLifecycleStep) => {
    setSelectedStep(step);
    if (step === 'preflight' || step === 'build') props.navigation.selectStep(step);
    if (step === 'stagingDeploy' || step === 'stagingValidation') {
      props.navigation.selectStagingStep(step);
    }
  };

  return (
    <div className="space-y-3">
      <ReleaseLifecycleRail
        stages={stages}
        selected={activeStage.key}
        onSelect={selectStage}
      />
      <section
        id={releaseLifecycleStagePanelId(activeStage.key)}
        role="tabpanel"
        aria-labelledby={releaseLifecycleStageTabId(activeStage.key)}
        className={`rounded-xl border bg-white p-5 sm:p-6 ${PROJECT_SURFACE_SHADOW}`}
      >
        {decisionBelongsHere(props.decisionStep, activeStage.key) ? (
          <div className="mb-5">{props.decisionAlert}</div>
        ) : null}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
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
        <ReleaseLifecycleSubsteps
          steps={activeStage.steps}
          selected={activeStep.key}
          onSelect={selectStep}
        />
        <div
          id={releaseLifecycleStepPanelId(activeStep.key)}
          role="tabpanel"
          aria-labelledby={releaseLifecycleStepTabId(activeStep.key)}
          tabIndex={0}
          className="mt-6 border-t pt-5"
        >
          <ReleaseLifecycleActivePanel
            {...props}
            lifecycleEvidence={lifecycleEvidence}
            stage={activeStage.key}
            step={activeStep.key}
          />
        </div>
      </section>
      {props.navigation.history !== 'builds' ? (
        <ReleaseBuildLogLayer
          projectId={props.projectId}
          releaseOrderId={props.releaseOrderId}
          builds={props.builds}
          buildRunId={props.navigation.buildRunId}
          onClose={props.navigation.closeLog}
        />
      ) : null}
      {props.navigation.history !== 'deploys' ? (
        <ReleaseStagingLogLayer
          projectId={props.projectId}
          builds={props.builds}
          deployments={props.deployments}
          deploymentRunId={props.navigation.deploymentRunId}
          view={props.navigation.deploymentEvidence}
          onClose={props.navigation.closeLog}
        />
      ) : null}
    </div>
  );
}

function stagingNavigationStep(
  step: 'preflight' | 'build' | 'staging',
  stagingStep: 'deploy' | 'validation',
) {
  if (step !== 'staging') return step;
  return stagingStep === 'validation' ? 'stagingValidation' : 'stagingDeploy';
}

function decisionBelongsHere(step: ReleaseOrderDetail['resumeStep'], stage: ReleaseLifecycleStage) {
  return stage === 'production'
    ? step === 'production'
    : stage === 'staging' && step !== 'production';
}
