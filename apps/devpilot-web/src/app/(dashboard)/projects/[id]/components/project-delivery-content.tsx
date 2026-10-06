'use client';

import React from 'react';
import { ReleaseOrdersPanel } from './release-orders-panel';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';

export function ProjectDeliveryContent({
  projectId,
  orders,
  embedded = false,
}: {
  projectId: string;
  orders: ReleaseOrdersHook;
  embedded?: boolean;
}) {
  return (
    <ReleaseOrdersPanel
      projectId={projectId}
      orders={orders}
      embedded={embedded}
    />
  );
}
