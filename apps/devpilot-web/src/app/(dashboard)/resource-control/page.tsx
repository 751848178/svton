'use client';

import { Suspense as ReactSuspense } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('resourceControl');
  const tc = useTranslations('common');
  const rc = useResourceControl();

  if (rc.loading) return <LoadingState text={tc('loading')} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
      />
      {rc.error ? <ErrorBanner message={rc.error} /> : null}
      <ResourceListPanel rc={rc} />
      <ActionRunsPanel rc={rc} />
      <ConnectionQueryPanel rc={rc} />
    </div>
  );
}

export default function ResourceControlPage() {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<LoadingState text={tc('loading')} />}>
      <ResourceControlContent />
    </Suspense>
  );
}
