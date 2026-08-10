'use client';

import type { ReleaseBuildsController } from '../hooks/use-release-builds';
import type { ReleaseOrderEvidenceHook } from '../hooks/use-release-order-evidence';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../types/release-order.types';
import { ReleaseOrderBuildStep } from './release-order-build-step';
import { ReleaseOrderPreflightStep } from './release-order-preflight-step';
import { ReleaseOrderProductionStep } from './release-order-production-step';
import { ReleaseOrderStagingStep } from './release-order-staging-step';

interface Props {
  detail: ReleaseOrderDetail;
  builds: ReleaseBuildsController;
  evidence: ReleaseOrderEvidenceHook;
  step: ReleaseOrderStep;
  projectId: string;
  releaseOrderId: string;
  focusedBuildRunId?: string;
  focusedDeploymentRunId?: string;
  focusedReleaseRunId?: string;
  onChanged: () => Promise<unknown>;
  onOpenBuildLog: (runId: string) => void;
  onCloseBuildLog: () => void;
  onFocusStaging: (runId: string) => void;
  onCloseStaging: () => void;
  onFocusProduction: (releaseRunId: string, deploymentRunId?: string) => void;
  onOpenProductionLog: (releaseRunId: string, deploymentRunId: string) => void;
  onCloseProductionLog: () => void;
  recoveryHref: string;
}

export function ReleaseOrderStepContent(props: Props) {
  if (props.step === 'preflight') return <ReleaseOrderPreflightStep detail={props.detail} />;
  if (props.step === 'build') {
    return (
      <ReleaseOrderBuildStep
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        builds={props.builds}
        focusedBuildRunId={props.focusedBuildRunId}
        onOpenLog={props.onOpenBuildLog}
        onCloseLog={props.onCloseBuildLog}
      />
    );
  }
  if (props.step === 'staging') {
    return (
      <ReleaseOrderStagingStep
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        focusedDeploymentRunId={props.focusedDeploymentRunId}
        onOpenLog={props.onFocusStaging}
        onCloseLog={props.onCloseStaging}
        onChanged={props.onChanged}
      />
    );
  }
  return (
    <ReleaseOrderProductionStep
      projectId={props.projectId}
      releaseOrderId={props.releaseOrderId}
      releaseVersion={props.detail.releaseVersion}
      productionArtifactFrozen={props.detail.counts.releaseRuns > 0}
      evidence={props.evidence}
      focusedReleaseRunId={props.focusedReleaseRunId}
      focusedDeploymentRunId={props.focusedDeploymentRunId}
      recoveryHref={props.recoveryHref}
      onFocus={props.onFocusProduction}
      onOpenLog={props.onOpenProductionLog}
      onCloseLog={props.onCloseProductionLog}
      onChanged={props.onChanged}
    />
  );
}
