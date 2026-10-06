'use client';

import { useParams } from 'next/navigation';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import { useReleaseOrders } from '../hooks/use-release-orders';
import { ReleaseOrderDetailPanel } from './release-order-detail-panel';

/** Standalone second-level release detail route. */
export function ProjectReleaseDetailRoute() {
  const params = useParams();
  const projectId = params.id as string;
  const releaseOrderId = params.releaseOrderId as string;
  const delivery = useProjectDeliverySummary(projectId);
  const orders = useReleaseOrders(projectId);

  return (
    <ReleaseOrderDetailPanel
      projectId={projectId}
      releaseOrderId={releaseOrderId}
      projectSummary={delivery.summary}
      onOrdersChanged={orders.load}
    />
  );
}
