/** 监控静默面板。 */
'use client';
import { EmptyState, Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useMonitoring } from '../hooks/use-monitoring';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function SilencesPanel({ m }: { m: MonitoringHook }) {
  if (m.silences.length === 0) return <EmptyState text="暂无静默规则" />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">静默规则</h2>
      </div>
      <div className="divide-y">
        {m.silences.map((silence) => (
          <div
            key={silence.id}
            className="px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">{silence.name || silence.id.slice(0, 8)}</h3>
                <div className="mt-1 flex gap-1">
                  {(
                    ((silence as unknown as Record<string, unknown>).severityFilter as string[]) ||
                    []
                  ).map((sev: string) => (
                    <Tag
                      key={sev}
                      color="default"
                    >
                      {sev}
                    </Tag>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <StatusTag status={silence.status === 'active' ? 'active' : 'inactive'} />
                <button
                  onClick={() =>
                    m.updateSilenceStatus(
                      silence,
                      silence.status === 'active' ? 'expired' : 'active',
                    )
                  }
                  className="rounded border px-2 py-1 text-xs hover:bg-accent"
                >
                  {silence.status === 'active' ? '停用' : '启用'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
