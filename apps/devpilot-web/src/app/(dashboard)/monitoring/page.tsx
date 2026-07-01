'use client';

import { Suspense as ReactSuspense, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingState } from '@svton/ui';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { useMonitoring } from './hooks/use-monitoring';
import { RulesPanel } from './components/rules-panel';
import { EventsPanel } from './components/events-panel';
import { SilencesPanel } from './components/silences-panel';
import { ChannelsPanel } from './components/channels-panel';
import { DashboardPanels } from './components/dashboard-panels';

// React 19 类型下 Suspense 跨包 JSX 校验差异，用类型断言绕过（TS2786）
const Suspense = ReactSuspense as unknown as (props: {
  fallback: ReactNode;
  children: ReactNode;
}) => JSX.Element;

function MonitoringContent() {
  const searchParams = useSearchParams();
  const applicationServiceId = searchParams.get('applicationServiceId') || '';
  const m = useMonitoring({ applicationServiceId });

  if (m.loading) return <LoadingState text="加载中..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="监控告警"
        description="管理告警规则、事件、静默、通知通道与仪表盘"
      />
      {m.error ? <ErrorBanner message={m.error} /> : null}
      <DashboardPanels m={m} />
      <RulesPanel m={m} />
      <EventsPanel m={m} />
      <SilencesPanel m={m} />
      <ChannelsPanel m={m} />
    </div>
  );
}

export default function MonitoringPage() {
  return (
    <Suspense fallback={<LoadingState text="加载中..." />}>
      <MonitoringContent />
    </Suspense>
  );
}
