'use client';

import { Suspense as ReactSuspense, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('monitoring');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const applicationServiceId = searchParams.get('applicationServiceId') || '';
  const m = useMonitoring({ applicationServiceId });

  if (m.loading) return <LoadingState text={tc('loading')} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
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
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<LoadingState text={tc('loading')} />}>
      <MonitoringContent />
    </Suspense>
  );
}
