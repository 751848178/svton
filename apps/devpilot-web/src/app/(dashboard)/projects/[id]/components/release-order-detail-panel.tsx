'use client';

import { useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import { useReleaseOrderDetail } from '../hooks/use-release-order-detail';
import { useReleaseOrderEvidence } from '../hooks/use-release-order-evidence';
import { useReleaseGateCatalog } from '../hooks/use-release-gate-catalog';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { useReleaseOrderWorkbenchNavigation } from '../hooks/use-release-order-workbench-navigation';
import { scopedRequestIdentity } from '../hooks/use-scoped-request-guard';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { buildReleaseOrderGateView } from './release-order-gate-view.model';
import { ReleaseOrderDetailWorkbench } from './release-workbench/release-order-detail-workbench';

interface Props {
  projectId: string;
  releaseOrderId: string;
  projectSummary?: ProjectDeliverySummary;
  onOrdersChanged: () => Promise<unknown>;
}

export function ReleaseOrderDetailPanel(props: Props) {
  const { projectId, releaseOrderId, onOrdersChanged } = props;
  const t = useTranslations('projects');
  const locale = useLocale();
  const order = useReleaseOrderDetail(projectId, releaseOrderId);
  const evidence = useReleaseOrderEvidence(projectId, releaseOrderId);
  const gateCatalog = useReleaseGateCatalog(projectId, releaseOrderId);
  const scope = scopedRequestIdentity(projectId, releaseOrderId);
  const detail = ownsDetail(order.scope, order.detail, scope, props);
  const navigation = useReleaseOrderWorkbenchNavigation({ projectId, releaseOrderId, detail });
  const loadOrder = order.load;
  const loadEvidence = evidence.load;
  const refresh = useCallback(async () => {
    await Promise.all([loadOrder(), loadEvidence(), onOrdersChanged()]);
  }, [loadEvidence, loadOrder, onOrdersChanged]);
  const builds = useReleaseBuilds(projectId, releaseOrderId, refresh, Boolean(detail), 50);
  const deployments = useReleaseStagingDeployments(projectId, releaseOrderId, refresh);
  const gateView = buildReleaseOrderGateView({
    projectId,
    locale,
    catalog: gateCatalog.catalog,
    state: gateCatalog,
  });

  if (order.loading) return <LoadingState />;
  if (order.error || !detail) {
    return (
      <ErrorBanner
        message={order.error || t('releaseOrderDetailUnavailable')}
        onRetry={order.load}
      />
    );
  }
  const buildFrozen = detail.counts.releaseRuns > 0;
  const triggerBuild = () => {
    if (!gateView.build.allowed || buildFrozen || builds.building) return;
    navigation.selectStep('build');
    void builds.buildLatest();
  };

  return (
    <div className="relative">
      <ReleaseOrderDetailWorkbench
        projectId={projectId}
        releaseOrderId={releaseOrderId}
        projectSummary={props.projectSummary}
        detail={detail}
        builds={builds}
        deployments={deployments}
        evidence={evidence}
        gateCatalog={gateCatalog}
        gateView={gateView}
        navigation={navigation}
        onRefresh={refresh}
        onBuildLatest={triggerBuild}
      />
    </div>
  );
}

function ownsDetail(
  loadedScope: string | null,
  detail: ReleaseOrderDetail | null,
  expectedScope: string,
  props: Pick<Props, 'projectId' | 'releaseOrderId'>,
) {
  if (loadedScope !== expectedScope) return null;
  if (detail?.projectId !== props.projectId || detail.id !== props.releaseOrderId) return null;
  return detail;
}
