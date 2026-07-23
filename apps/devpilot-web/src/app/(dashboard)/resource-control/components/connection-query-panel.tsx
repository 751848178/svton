/** 资源连接与查询面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { useResourceControl } from '../hooks/use-resource-control';
type RCHook = ReturnType<typeof useResourceControl>;

/** 连接 / 查询运行列表显示上限。 */
const RUNS_LIMIT = 10;

export function ConnectionQueryPanel({ rc }: { rc: RCHook }) {
  const t = useTranslations('resourceControl');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RunListCard
        title={t('connectionRuns')}
        emptyText={t('noConnectionRuns')}
        runs={rc.connectionRuns}
      />
      <RunListCard
        title={t('queryRuns')}
        emptyText={t('noQueryRuns')}
        runs={rc.queryRuns}
      />
    </div>
  );
}

function RunListCard({
  title,
  emptyText,
  runs,
}: {
  title: string;
  emptyText: string;
  runs: RCHook['connectionRuns'];
}) {
  const t = useTranslations('resourceControl');
  const visible = runs.slice(0, RUNS_LIMIT);
  const hidden = runs.length - visible.length;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
      </div>
      {runs.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <>
          <div className="divide-y">
            {visible.map((run) => (
              <div
                key={run.id}
                className="px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{run.resource?.name || t('unnamedResource')}</span>
                  <StatusTag status={run.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDateTimeMinute(run.startedAt)}
                </div>
              </div>
            ))}
          </div>
          {hidden > 0 ? (
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              {t('showingPartial', { shown: visible.length, total: runs.length })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
