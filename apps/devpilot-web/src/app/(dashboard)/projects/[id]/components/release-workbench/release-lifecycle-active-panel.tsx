'use client';

import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import type { ReleaseOrderWorkbenchNavigation } from '../../hooks/use-release-order-workbench-navigation';
import type { useReleaseGateCatalog } from '../../hooks/use-release-gate-catalog';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type { ReleaseBuildItem, ReleaseOrderDetail } from '../../types/release-order.types';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseStagingValidationEvidence } from '../../utils/release-staging-view.model';
import type { buildReleaseOrderGateView } from '../release-order-gate-view.model';
import type { WorkbenchPublishState } from './release-workbench-actions.model';
import type { ReleaseLifecycleStage, ReleaseLifecycleStep } from './release-lifecycle.model';
import type { ReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';
import { ReleaseLifecycleOutcomePanel } from './release-lifecycle-outcome-panel';
import { ReleaseLifecycleStepPanel } from './release-lifecycle-step-panel';
import { ReleaseProductionView } from './release-production-view';
import { ReleaseStepProductionCheckPanel } from './release-step-production-check-panel';

interface Props {
  stage: ReleaseLifecycleStage;
  step: ReleaseLifecycleStep;
  projectId: string;
  releaseOrderId: string;
  detail: ReleaseOrderDetail;
  projectSummary?: ProjectDeliverySummary;
  builds: ReleaseBuildsController;
  deployments: ReleaseStagingDeploymentsController;
  productionRuns: ReleaseEvidenceProductionRun[];
  stagingProof: ReleaseStagingValidationEvidence | null;
  lifecycleEvidence: ReleaseLifecycleEvidence;
  manifestBuild: ReleaseBuildItem | null;
  gateCatalog: ReturnType<typeof useReleaseGateCatalog>;
  buildGate: ReturnType<typeof buildReleaseOrderGateView>['build'];
  navigation: ReleaseOrderWorkbenchNavigation;
  publish: WorkbenchPublishState;
  publishTitle?: string;
  publishRepairHref?: string;
  onPublish: () => void;
  onBuildLatest: () => void;
  onRefresh: () => Promise<unknown>;
}

export function ReleaseLifecycleActivePanel(props: Props) {
  if (props.stage === 'staging') {
    return (
      <ReleaseLifecycleStepPanel
        {...props}
        selected={props.step}
      />
    );
  }
  if (props.stage === 'production' && props.step === 'productionCheck') {
    return (
      <ReleaseStepProductionCheckPanel
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        stagingProof={props.stagingProof}
        manifestBuild={props.manifestBuild}
        productionRun={props.productionRuns[0] ?? null}
        onChanged={props.onRefresh}
      />
    );
  }
  if (props.stage === 'production') {
    return (
      <ReleaseProductionView
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        manifestBuild={props.manifestBuild}
        stagingProof={props.stagingProof}
        productionRuns={props.productionRuns}
        stagingProven={props.lifecycleEvidence.staging === 'passed'}
        onChanged={props.onRefresh}
        environmentHref={props.navigation.recoveryHref}
        focusedRunId={props.navigation.releaseRunId}
        onFocusRun={props.navigation.openProductionLog}
        onCloseRunLog={props.navigation.closeProductionLog}
      />
    );
  }
  return (
    <ReleaseLifecycleOutcomePanel
      mode={props.stage}
      detail={props.detail}
      lifecycleEvidence={props.lifecycleEvidence}
    />
  );
}
