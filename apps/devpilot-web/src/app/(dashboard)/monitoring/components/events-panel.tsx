/** 监控告警事件面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
import type { useMonitoring } from '../hooks/use-monitoring';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function EventsPanel({ m }: { m: MonitoringHook }) {
  const t = useTranslations('monitoring');
  const tc = useTranslations('common');
  if (m.events.length === 0) return <EmptyState text={t('noAlertEvents')} />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">{t('alertEvents')}</h2>
      </div>
      <div className="divide-y">
        {m.events.map((event) => (
          <div
            key={event.id}
            className="px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{event.metric}</h3>
                <div className="mt-1 text-xs text-muted-foreground">
                  {event.summary || event.metric}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(event.occurredAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusTag
                  status={event.severity}
                  variant="risk"
                />
                {event.status === 'firing' && (
                  <button
                    onClick={() => m.acknowledgeEvent(event)}
                    disabled={m.actingId === `event:${event.id}:ack`}
                    className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {tc('confirm')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
