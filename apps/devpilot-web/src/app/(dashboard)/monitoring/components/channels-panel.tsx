/** 监控通知通道面板。 */
'use client';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useMonitoring } from '../hooks/use-monitoring';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function ChannelsPanel({ m }: { m: MonitoringHook }) {
  if (m.notificationChannels.length === 0) return <EmptyState text="暂无通知通道" />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">通知通道</h2>
      </div>
      <div className="divide-y">
        {m.notificationChannels.map((channel) => (
          <div
            key={channel.id}
            className="px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">{channel.name}</h3>
                <div className="mt-1 text-xs text-muted-foreground">{channel.type}</div>
              </div>
              <div className="flex gap-2">
                <StatusTag status={channel.status === 'active' ? 'active' : 'inactive'} />
                <button
                  onClick={() =>
                    m.updateNotificationChannelStatus(
                      channel,
                      channel.status === 'active' ? 'inactive' : 'active',
                    )
                  }
                  className="rounded border px-2 py-1 text-xs hover:bg-accent"
                >
                  {channel.status === 'active' ? '停用' : '启用'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
