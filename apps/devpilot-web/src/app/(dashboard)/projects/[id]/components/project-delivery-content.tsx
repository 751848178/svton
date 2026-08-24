'use client';

import React from 'react';
import { ReleaseOrdersPanel } from './release-orders-panel';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';

export function ProjectDeliveryContent({
  projectId,
  orders,
  summary,
}: {
  projectId: string;
  orders: ReleaseOrdersHook;
  summary?: ProjectDeliverySummary;
}) {
  return (
    <ReleaseOrdersPanel
      projectId={projectId}
      orders={orders}
      summary={summary}
    />
  );
}
