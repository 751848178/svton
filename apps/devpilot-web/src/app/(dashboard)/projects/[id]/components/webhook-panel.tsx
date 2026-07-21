/** 项目 Webhook 面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { EmptyState, Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

export function WebhookPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  if (detail.webhooks.length === 0) return <EmptyState text={t('noWebhooks')} />;
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 font-semibold">Webhook</h2>
      <div className="space-y-2">
        {detail.webhooks.map((hook) => {
          const eventTypes = Array.isArray(hook.eventTypes)
            ? (hook.eventTypes as string[])
            : [];
          return (
            <div
              key={hook.id}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{hook.name}</span>
                <div className="flex items-center gap-2">
                  <Tag color="cyan">{hook.provider}</Tag>
                  <StatusTag status={hook.enabled ? 'active' : 'inactive'} />
                </div>
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{hook.urlToken}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t('webhookEvents')}: {eventTypes.length > 0 ? eventTypes.join(', ') : '-'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t('webhookLastDelivery')}:{' '}
                {hook.lastDeliveryAt
                  ? formatDateTimeMinute(hook.lastDeliveryAt)
                  : t('webhookNoDelivery')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
