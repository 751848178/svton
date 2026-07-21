/** 监控通知投递列表面板（含失败重试）。 */
'use client';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
import { notificationChannelTypeLabels } from '../constants';
import type { useMonitoring } from '../hooks/use-monitoring';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function NotificationDeliveriesPanel({ m }: { m: MonitoringHook }) {
  const t = useTranslations('monitoring');
  const tc = useTranslations('common');
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">{t('deliveriesTitle')}</h2>
      </div>
      {m.notificationDeliveries.length === 0 ? (
        <EmptyState text={t('noDeliveries')} />
      ) : (
        <div className="divide-y">
          {m.notificationDeliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-medium">
                    {delivery.channel?.name ||
                      notificationChannelTypeLabels[delivery.channelType] ||
                      delivery.channelType}
                  </h3>
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    {delivery.alertEvent?.summary || delivery.alertEvent?.metric || '-'}
                  </div>
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    {delivery.target ? `${delivery.target} · ` : ''}
                    {formatDateTime(delivery.attemptedAt || delivery.createdAt)}
                  </div>
                  {delivery.error ? (
                    <div className="mt-1 break-words text-xs text-red-600">{delivery.error}</div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusTag status={delivery.status} />
                  {delivery.status === 'failed' && (
                    <button
                      onClick={() => m.retryNotificationDelivery(delivery)}
                      disabled={m.actingId === `delivery:${delivery.id}`}
                      className="inline-flex min-h-10 items-center rounded border px-3 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      {tc('retry')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
