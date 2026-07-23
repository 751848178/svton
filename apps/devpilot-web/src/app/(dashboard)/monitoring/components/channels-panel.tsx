/** 监控通知通道面板（含通知投递列表与失败重试）。 */
'use client';
import { useTranslations } from 'next-intl';
import { useBoolean } from '@svton/hooks';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { CreateChannelModal } from './create-channel-modal';
import { NotificationDeliveriesPanel } from './notification-deliveries-panel';
import { notificationChannelTypeLabels } from '../constants';
import type { useMonitoring } from '../hooks/use-monitoring';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function ChannelsPanel({ m }: { m: MonitoringHook }) {
  const t = useTranslations('monitoring');
  const [createOpen, { setTrue: openCreate, setFalse: closeCreate }] = useBoolean(false);
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="font-semibold">{t('notificationChannels')}</h2>
          <button
            onClick={openCreate}
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            + {t('createChannel')}
          </button>
        </div>
        {m.notificationChannels.length === 0 ? (
          <EmptyState text={t('noNotificationChannels')} />
        ) : (
          <div className="divide-y">
            {m.notificationChannels.map((channel) => (
              <div
                key={channel.id}
                className="px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{channel.name}</h3>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {notificationChannelTypeLabels[channel.type] || channel.type}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <StatusTag status={channel.status === 'active' ? 'active' : 'inactive'} />
                    <button
                      onClick={() =>
                        m.updateNotificationChannelStatus(
                          channel,
                          channel.status === 'active' ? 'paused' : 'active',
                        )
                      }
                      disabled={m.actingId === `channel:${channel.id}`}
                      className="inline-flex min-h-10 items-center rounded border px-3 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      {channel.status === 'active' ? t('disable') : t('enable')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <CreateChannelModal
          open={createOpen}
          creating={m.creatingChannel}
          error={m.error}
          onClose={closeCreate}
          onCreate={m.createNotificationChannel}
        />
      </div>
      <NotificationDeliveriesPanel m={m} />
    </div>
  );
}
