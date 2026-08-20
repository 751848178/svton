'use client';

import { useLocale } from 'next-intl';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseOrderEvidenceHook } from '../../hooks/use-release-order-evidence';
import type { ReleaseOrderWorkbenchNavigation } from '../../hooks/use-release-order-workbench-navigation';
import type { useReleaseGateCatalog } from '../../hooks/use-release-gate-catalog';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { buildReleaseOrderGateView } from '../release-order-gate-view.model';
import { ReleaseOrderStepContent } from '../release-order-step-content';
import { buildReleaseOrderStepViews } from '../release-order-stepper.model';
import { ReleaseOrderStepper } from '../release-order-stepper';
import { ReleaseWorkbenchDecisionCard } from './release-workbench-decision-card';
import { ReleaseWorkbenchHeader } from './release-workbench-header';
import { ReleaseWorkbenchLayout } from './release-workbench-layout';
import { ReleaseWorkbenchRail } from './release-workbench-rail';
import { ReleaseWorkbenchTechnicalDetails } from './release-workbench-technical-details';
import {
  buildReleaseWorkbenchGateSummary,
  releaseWorkbenchDecisionStep,
} from './release-workbench-summary.model';

interface Props {
  projectId: string;
  releaseOrderId: string;
  projectSummary?: ProjectDeliverySummary;
  detail: ReleaseOrderDetail;
  builds: ReleaseBuildsController;
  evidence: ReleaseOrderEvidenceHook;
  gateCatalog: ReturnType<typeof useReleaseGateCatalog>;
  gateView: ReturnType<typeof buildReleaseOrderGateView>;
  navigation: ReleaseOrderWorkbenchNavigation;
  onRefresh: () => Promise<unknown>;
  onBuildLatest: () => void;
}

export function ReleaseOrderDetailWorkbench(props: Props) {
  const { detail, builds, evidence, gateCatalog, navigation } = props;
  const locale = useLocale();
  const decisionStep = releaseWorkbenchDecisionStep(detail);
  const catalogGate = buildReleaseWorkbenchGateSummary({
    step: decisionStep,
    catalog: gateCatalog.catalog,
    loading: gateCatalog.loading,
    error: gateCatalog.error,
    locale,
  });
  const actionGate = decisionStep === 'staging' ? props.gateView.staging : props.gateView.build;
  const gate =
    decisionStep !== 'production' && !actionGate.allowed && catalogGate.state === 'ready'
      ? {
          ...catalogGate,
          state: 'blocked' as const,
          blockerCount: Math.max(1, catalogGate.blockerCount),
          reason: actionGate.reason,
        }
      : catalogGate;
  const reviewGate = () => {
    navigation.selectStep('preflight');
    requestAnimationFrame(() => requestAnimationFrame(openGateDetails));
  };

  return (
    <div className="space-y-5">
      <ReleaseWorkbenchHeader
        detail={detail}
        projectSummary={props.projectSummary}
        evidence={evidence.evidence}
        onBack={navigation.back}
      />
      <ReleaseWorkbenchLayout
        main={
          <div className="space-y-4">
            <ReleaseWorkbenchDecisionCard
              decisionStep={decisionStep}
              executionStep={detail.resumeStep}
              selectedStep={navigation.step}
              gate={gate}
              actionGate={actionGate}
              building={builds.building}
              buildFrozen={detail.counts.releaseRuns > 0}
              targetRepairHref={
                decisionStep === 'staging' &&
                catalogGate.state === 'ready' &&
                props.gateView.staging.repairArea === 'targets'
                  ? props.gateView.stagingHref
                  : undefined
              }
              onBuildLatest={props.onBuildLatest}
              onReviewGate={reviewGate}
              onReturnToExecution={() => navigation.selectStep(detail.resumeStep)}
            />
            <ReleaseOrderStepper
              steps={buildReleaseOrderStepViews(detail)}
              selectedStep={navigation.step}
              onSelect={navigation.selectStep}
            >
              <ReleaseOrderStepContent
                detail={detail}
                builds={builds}
                evidence={evidence}
                gateCatalog={gateCatalog}
                step={navigation.step}
                projectId={props.projectId}
                releaseOrderId={props.releaseOrderId}
                focusedBuildRunId={navigation.buildRunId}
                focusedDeploymentRunId={navigation.deploymentRunId}
                focusedReleaseRunId={navigation.releaseRunId}
                onChanged={props.onRefresh}
                onOpenBuildLog={navigation.openBuildLog}
                onCloseBuildLog={navigation.closeBuildLog}
                onFocusStaging={navigation.focusStaging}
                onCloseStaging={navigation.closeStaging}
                onFocusProduction={navigation.focusProduction}
                onOpenProductionLog={navigation.focusProduction}
                onCloseProductionLog={navigation.closeProductionLog}
                recoveryHref={navigation.recoveryHref}
                buildGate={props.gateView.build}
                stagingGate={props.gateView.staging}
                stagingRepairHref={props.gateView.stagingHref}
              />
            </ReleaseOrderStepper>
          </div>
        }
        rail={
          <ReleaseWorkbenchRail
            detail={detail}
            evidence={evidence}
            catalog={gateCatalog.catalog}
            onOpenActivity={navigation.openActivity}
            onSelectStep={navigation.selectStep}
          />
        }
      />
      <ReleaseWorkbenchTechnicalDetails
        detail={detail}
        evidence={evidence.evidence}
      />
    </div>
  );
}

function openGateDetails() {
  const section = document.getElementById('release-gate-details');
  const details = section?.querySelector('details');
  if (details instanceof HTMLDetailsElement) details.open = true;
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
