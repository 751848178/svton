/** 采集运行与保留运行记录面板。 */
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { useLogs } from '../hooks/use-logs';
import { formatDateTimeMinute } from '@/lib/format-date';
type LogsHook = ReturnType<typeof useLogs>;

export function LogsRunsSection({ logs }: { logs: LogsHook }) {
  const tl = useTranslations('logs');
  const tc = useTranslations('common');
  const s = logs.s;
  const t = logs.t;
  const selectedStreamId = logs.selectedStream?.id;
  const visibleCollectionRuns = selectedStreamId
    ? s.collectionRuns.filter((run) => run.stream?.id === selectedStreamId)
    : s.collectionRuns;
  const visibleRetentionRuns = selectedStreamId
    ? s.retentionRuns.filter((run) => run.streamId === selectedStreamId || run.stream?.id === selectedStreamId)
    : s.retentionRuns;
  const [cleanupLiveOpen, setCleanupLiveOpen] = useState(false);
  const handleCollect = usePersistFn(() => logs.collectSelectedStream());
  const handleCleanupDry = usePersistFn(() => logs.cleanupSelectedRetention(true));
  const handleCleanupLive = usePersistFn(() => setCleanupLiveOpen(true));
  const confirmCleanupLive = usePersistFn(() => logs.cleanupSelectedRetention(false));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">{tl('collectionRuns')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={t.queueLogCollections}
                onChange={(e) => t.setQueueLogCollections(e.target.checked)}
              />
              {tl('enqueue')}
            </label>
            <button
              onClick={handleCollect}
              disabled={s.collecting}
              className="min-h-11 rounded-md border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50"
            >
              {s.collecting ? tl('generating') : tl('generateCollection')}
            </button>
          </div>
        </div>
        {visibleCollectionRuns.length === 0 ? (
          <EmptyState text={tl('noCollectionRuns')} />
        ) : (
          <div className="space-y-2">
            {visibleCollectionRuns.slice(0, 10).map((run) => (
              <div
                key={run.id}
                className="rounded-md border px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{run.sourceType}</span>
                  <StatusTag status={run.status} />
                </div>
                <div className="mt-1 text-muted-foreground">
                  {formatDateTimeMinute(run.startedAt)}
                  {run.finishedAt ? ` → ${formatDateTimeMinute(run.finishedAt)}` : ''}
                </div>
                {run.error && <div className="mt-1 text-red-600">{run.error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">{tl('retentionCleanup')}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCleanupDry}
              disabled={t.cleaningRetention === 'dry-run'}
              className="min-h-11 rounded-md border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50"
            >
              {t.cleaningRetention === 'dry-run' ? tl('executing') : tl('dryRun')}
            </button>
            <button
              onClick={handleCleanupLive}
              disabled={t.cleaningRetention === 'live'}
              className="min-h-11 rounded-md border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50"
            >
              {t.cleaningRetention === 'live' ? tl('executing') : tl('live')}
            </button>
          </div>
        </div>
        {visibleRetentionRuns.length === 0 ? (
          <EmptyState text={tl('noRetentionRuns')} />
        ) : (
          <div className="space-y-2">
            {visibleRetentionRuns.slice(0, 10).map((run) => (
              <div
                key={run.id}
                className="rounded-md border px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{run.dryRun ? tl('dryRun') : tl('live')}</span>
                  <StatusTag status={run.status} />
                </div>
                <div className="mt-1 text-muted-foreground">
                  {tl('retentionDeleted', { deleted: run.deletedEntryCount, matched: run.matchedEntryCount })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cleanupLiveOpen}
        onOpenChange={setCleanupLiveOpen}
        tone="danger"
        title={tl('confirmLiveRetentionCleanupTitle')}
        description={tl('confirmLiveRetentionCleanup')}
        confirmLabel={tc('confirm')}
        cancelLabel={tc('cancel')}
        onConfirm={confirmCleanupLive}
      />
    </div>
  );
}
