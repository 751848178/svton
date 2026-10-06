/** Basic release composition. Governed production and evidence views stay dormant for later use. */
'use client';

import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import type { ReleaseOrderWorkbenchNavigation } from '../../hooks/use-release-order-workbench-navigation';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { buildReleaseOrderGateView } from '../release-order-gate-view.model';
import { ReleaseBasicFlow } from './release-basic-flow';
import { ReleaseBasicProductionLogDrawer } from './release-basic-production-log-drawer';
import { ReleaseBuildLogLayer } from './release-build-log-layer';
import { ReleaseWorkbenchHeader } from './release-workbench-header';
import { ReleaseInputSummary } from './release-input-summary';
import { ReleaseStagingLogLayer } from './release-staging-log-layer';

interface Props {
  projectId: string;
  releaseOrderId: string;
  projectSummary?: ProjectDeliverySummary;
  detail: ReleaseOrderDetail;
  builds: ReleaseBuildsController;
  deployments: ReleaseStagingDeploymentsController;
  productionRuns: ReleaseEvidenceProductionRun[];
  gateView: ReturnType<typeof buildReleaseOrderGateView>;
  navigation: ReleaseOrderWorkbenchNavigation;
  onRefresh: () => Promise<unknown>;
  onBuildLatest: () => void;
}

export function ReleaseOrderDetailWorkbench(props: Props) {
  const { detail, builds, deployments, navigation } = props;

  return (
    <div className="space-y-5">
      <ReleaseWorkbenchHeader
        detail={detail}
        onBack={navigation.back}
      />
      <ReleaseInputSummary
        detail={detail}
        projectSummary={props.projectSummary}
      />
      <ReleaseBasicFlow
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        projectSummary={props.projectSummary}
        detail={detail}
        builds={builds}
        deployments={deployments}
        productionRuns={props.productionRuns}
        gateView={props.gateView}
        navigation={navigation}
        onRefresh={props.onRefresh}
        onBuildLatest={props.onBuildLatest}
      />
      <ReleaseBuildLogLayer
        basic
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        builds={builds}
        buildRunId={navigation.buildRunId}
        onClose={navigation.closeLog}
      />
      <ReleaseStagingLogLayer
        basic
        projectId={props.projectId}
        builds={builds}
        deployments={deployments}
        deploymentRunId={navigation.deploymentRunId}
        onClose={navigation.closeLog}
      />
      <ReleaseBasicProductionLogDrawer
        run={props.productionRuns.find((run) => run.id === navigation.releaseRunId) ?? null}
        onClose={navigation.closeProductionLog}
      />
    </div>
  );
}
