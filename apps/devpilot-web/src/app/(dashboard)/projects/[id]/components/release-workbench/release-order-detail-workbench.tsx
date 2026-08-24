/**
 * 预发发布工作台组合：
 * 页头（标题 → 预警条 → 基本信息）
 * + 环境发布链（预发发布 → 生产发布，串行切换）
 * + [预发节点：三步步骤条（右上角「发布」）+ 步骤内联当前轮次面板 + 右侧轮次信息栏
 *    | 生产节点：生产发布视图（复用预发验证制品）]
 * + 历史抽屉（构建/部署全量记录，二层日志抽屉）。
 */
'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReleaseBuildsController } from '../../hooks/use-release-builds';
import type { ReleaseOrderEvidenceHook } from '../../hooks/use-release-order-evidence';
import type { ReleaseStagingDeploymentsController } from '../../hooks/use-release-staging-deployments';
import type { ReleaseOrderWorkbenchNavigation } from '../../hooks/use-release-order-workbench-navigation';
import type { useReleaseGateCatalog } from '../../hooks/use-release-gate-catalog';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { buildReleaseOrderGateView } from '../release-order-gate-view.model';
import { ReleaseWorkbenchDecisionCard } from './release-workbench-decision-card';
import { ReleaseWorkbenchHeader } from './release-workbench-header';
import { ReleaseBuildHistoryDrawer } from './release-build-history-drawer';
import { ReleaseDeployHistoryDrawer } from './release-deploy-history-drawer';
import { ReleaseEnvironmentChain } from './release-environment-chain';
import { buildReleaseChainViews } from './release-environment-chain.model';
import { ReleaseProductionView } from './release-production-view';
import {
  buildWorkbenchDecisionGate,
  workbenchPublishState,
} from './release-workbench-actions.model';
import {
  latestStagingDeployment,
  latestSuccessfulManifestBuild,
  productionManifestBuild,
  stagingProvenBuild,
} from './release-round.model';
import { ReleaseStagingView } from './release-staging-view';
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
  deployments: ReleaseStagingDeploymentsController;
  evidence: ReleaseOrderEvidenceHook;
  gateCatalog: ReturnType<typeof useReleaseGateCatalog>;
  gateView: ReturnType<typeof buildReleaseOrderGateView>;
  navigation: ReleaseOrderWorkbenchNavigation;
  onRefresh: () => Promise<unknown>;
  onBuildLatest: () => void;
}

export function ReleaseOrderDetailWorkbench(props: Props) {
  const { detail, builds, deployments, evidence, navigation } = props;
  const locale = useLocale();
  const t = useTranslations('projects');
  const decisionStep = releaseWorkbenchDecisionStep(detail);
  const catalogGate = buildReleaseWorkbenchGateSummary({
    step: decisionStep,
    catalog: props.gateCatalog.catalog,
    loading: props.gateCatalog.loading,
    error: props.gateCatalog.error,
    locale,
  });
  const actionGate = decisionStep === 'staging' ? props.gateView.staging : props.gateView.build;
  const gate = buildWorkbenchDecisionGate({ decisionStep, catalogGate, actionGate });
  const buildFrozen = detail.counts.releaseRuns > 0;
  const deployableBuild = latestSuccessfulManifestBuild(builds.items);
  const productionRuns = evidence.evidence?.productionReleaseRuns.items ?? [];
  const stagingProofRun = stagingProvenBuild(deployments.items, builds.items)
    ? latestStagingDeployment(
        deployments.items.filter((item) => item.status.toLowerCase() === 'completed' && !item.dryRun),
      )
    : null;
  const publish = workbenchPublishState({
    deployableBuild,
    stagingGate: props.gateView.staging,
    deploying: deployments.deploying,
  });
  const publishTitle = publish.noManifest
    ? t('releaseWorkbenchPublishDisabledNoManifest')
    : publish.blockedByGate
      ? props.gateView.staging.reason
      : undefined;
  const triggerPublish = () => {
    const manifestId = deployableBuild?.manifest?.id;
    if (publish.disabled || !manifestId) return;
    void deployments.deploy(manifestId);
  };

  return (
    <div className="space-y-5">
      <ReleaseWorkbenchHeader
        detail={detail}
        projectSummary={props.projectSummary}
        evidence={evidence.evidence}
        alert={
          <ReleaseWorkbenchDecisionCard
            decisionStep={decisionStep}
            gate={gate}
            targetRepairHref={
              decisionStep === 'staging' &&
              catalogGate.state === 'ready' &&
              props.gateView.staging.repairArea === 'targets'
                ? props.gateView.stagingHref
                : undefined
            }
            onReviewGate={() => navigation.selectStep('preflight')}
          />
        }
        onBack={navigation.back}
      />
      <ReleaseEnvironmentChain
        nodes={buildReleaseChainViews({
          detail,
          stagingProven: Boolean(stagingProofRun),
          productionRuns,
        })}
        selected={navigation.release}
        onSelect={navigation.selectRelease}
      />
      {navigation.release === 'production' ? (
        <ReleaseProductionView
          projectId={props.projectId}
          releaseOrderId={props.releaseOrderId}
          manifestBuild={productionManifestBuild({
            productionRuns,
            stagingRuns: deployments.items,
            builds: builds.items,
          })}
          stagingProof={stagingProofRun}
          productionRuns={productionRuns}
          stagingProven={Boolean(stagingProofRun)}
          onChanged={props.onRefresh}
          environmentHref={navigation.recoveryHref}
          focusedRunId={navigation.releaseRunId}
          onFocusRun={navigation.openProductionLog}
          onCloseRunLog={navigation.closeProductionLog}
        />
      ) : (
        <ReleaseStagingView
          projectId={props.projectId}
          releaseOrderId={props.releaseOrderId}
          detail={detail}
          builds={builds}
          deployments={deployments}
          gateCatalog={props.gateCatalog}
          buildGate={props.gateView.build}
          navigation={navigation}
          publish={publish}
          publishTitle={publishTitle}
          onPublish={triggerPublish}
          onBuildLatest={props.onBuildLatest}
        />
      )}
      <ReleaseBuildHistoryDrawer
        open={navigation.history === 'builds'}
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        builds={builds}
        focusedBuildRunId={navigation.buildRunId}
        onOpenLog={navigation.openBuildHistoryLog}
        onCloseLog={navigation.closeLog}
        onClose={navigation.closeHistory}
      />
      <ReleaseDeployHistoryDrawer
        open={navigation.history === 'deploys'}
        projectId={props.projectId}
        releaseOrderId={props.releaseOrderId}
        builds={builds}
        deployments={deployments}
        focusedDeploymentRunId={navigation.deploymentRunId}
        deployGate={props.gateView.staging}
        onOpenLog={navigation.openDeployHistoryLog}
        onCloseLog={navigation.closeLog}
        onClose={navigation.closeHistory}
      />
    </div>
  );
}
