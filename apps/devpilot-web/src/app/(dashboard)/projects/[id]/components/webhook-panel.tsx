/** 项目 Webhook 面板。 */
'use client';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

export function WebhookPanel({ detail }: { detail: DetailHook }) {
  if (detail.webhooks.length === 0) return <EmptyState text="暂无 Webhook" />;
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 font-semibold">Webhook</h2>
      <div className="space-y-2">
        {detail.webhooks.map((hook) => (
          <div
            key={hook.id}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{hook.name}</span>
              <StatusTag status={hook.enabled ? 'active' : 'inactive'} />
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">{hook.urlToken}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
