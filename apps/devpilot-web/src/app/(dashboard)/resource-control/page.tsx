'use client';

import { Suspense as ReactSuspense } from 'react';
import { LoadingState } from '@svton/ui';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { useResourceControl } from './hooks/use-resource-control';
import { ResourceListPanel } from './components/resource-list-panel';
import { ActionRunsPanel } from './components/action-runs-panel';
import { ConnectionQueryPanel } from './components/connection-query-panel';

// React 19 Suspense 类型断言
const Suspense = ReactSuspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => JSX.Element;

function ResourceControlContent() {
  const rc = useResourceControl();

  if (rc.loading) return <LoadingState text="加载中..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="资源管控"
        description="管理 Docker/云资源的同步、操作、连接与查询"
      />
      {rc.error ? <ErrorBanner message={rc.error} /> : null}
      <ResourceListPanel rc={rc} />
      <ActionRunsPanel rc={rc} />
      <ConnectionQueryPanel rc={rc} />
    </div>
  );
}

export default function ResourceControlPage() {
  return (
    <Suspense fallback={<LoadingState text="加载中..." />}>
      <ResourceControlContent />
    </Suspense>
  );
}
