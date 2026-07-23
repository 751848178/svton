/** 资源操作运行记录面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { resolveActionName } from '../resource-action-ui.utils';
import type { useResourceControl } from '../hooks/use-resource-control';
type RCHook = ReturnType<typeof useResourceControl>;

/** 操作运行列表显示上限。 */
const ACTION_RUNS_LIMIT = 20;

export function ActionRunsPanel({ rc }: { rc: RCHook }) {
  const t = useTranslations('resourceControl');
  if (rc.actionRuns.length === 0) return <EmptyState text={t('noActionRuns')} />;
  const visible = rc.actionRuns.slice(0, ACTION_RUNS_LIMIT);
  const hidden = rc.actionRuns.length - visible.length;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">{t('actionRuns')}</h2>
      </div>
      <div className="divide-y">
        {visible.map((run) => (
          <div
            key={run.id}
            className="px-4 py-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{resolveActionName(run.action, rc.actions)}</span>
              <StatusTag status={run.status} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatDateTimeMinute(run.startedAt)}
              {run.finishedAt ? ` → ${formatDateTimeMinute(run.finishedAt)}` : ''}
            </div>
            {run.error ? <div className="mt-1 text-xs text-destructive">{run.error}</div> : null}
          </div>
        ))}
      </div>
      {hidden > 0 ? (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {t('showingPartial', { shown: visible.length, total: rc.actionRuns.length })}
        </div>
      ) : null}
    </div>
  );
}
