'use client';

import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { useLogs } from './hooks/use-logs';
import { LogsToolbar } from './components/logs-toolbar';
import { LogsViewer } from './components/logs-viewer';
import { StreamsSidebar } from './components/streams-sidebar';
import { NewStreamModal } from './components/new-stream-modal';
import { StreamDetailDrawer } from './components/stream-detail-drawer';

export default function LogsPage() {
  const tl = useTranslations('logs');
  const tc = useTranslations('common');
  const logs = useLogs();

  if (logs.s.loading) return <LoadingState text={tc('loading')} />;

  return (
    <div className="flex h-full flex-col space-y-4">
      <PageHeader title={tl('pageTitle')} description={tl('pageDescription')} />

      {logs.s.error ? <ErrorBanner message={logs.s.error} /> : null}

      <LogsToolbar logs={logs} />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <StreamsSidebar logs={logs} />
        <LogsViewer logs={logs} />
      </div>

      <NewStreamModal logs={logs} />
      <StreamDetailDrawer logs={logs} />
    </div>
  );
}
