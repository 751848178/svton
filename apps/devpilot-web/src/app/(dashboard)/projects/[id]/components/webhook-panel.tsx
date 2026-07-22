/** 项目 Webhook 面板。 */
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState, Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { ProjectWebhook } from '../types/operations';

type DetailHook = ReturnType<typeof useProjectDetail>;
type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

/** 复制到剪贴板并触发「已复制」临时提示。 */
function useCopyToken() {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return { copied, copy };
}

export function WebhookPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  if (detail.webhooks.length === 0) return <EmptyState text={t('noWebhooks')} />;
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="font-semibold">{t('webhookTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('webhookPanelDescription')}</p>
      </div>
      <div className="space-y-2">
        {detail.webhooks.map((hook) => (
          <WebhookRow key={hook.id} hook={hook} t={t} />
        ))}
      </div>
    </div>
  );
}

function WebhookRow({ hook, t }: { hook: ProjectWebhook; t: ProjectsTranslator }) {
  const { copied, copy } = useCopyToken();
  const eventTypes = Array.isArray(hook.eventTypes) ? (hook.eventTypes as string[]) : [];
  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{hook.name}</span>
        <div className="flex items-center gap-2">
          <Tag color="cyan">
            {t('providerLabel')}: {hook.provider}
          </Tag>
          <StatusTag
            status={hook.enabled ? 'active' : 'inactive'}
            label={hook.enabled ? t('envStatusActive') : t('envStatusInactive')}
          />
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {t('urlTokenLabel')}: {hook.urlToken}
        </span>
        <button
          type="button"
          onClick={() => copy(hook.urlToken)}
          className="text-xs text-primary hover:underline"
        >
          {copied ? t('copied') : t('copyUrlToken')}
        </button>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {t('webhookEvents')}: {eventTypes.length > 0 ? eventTypes.join(', ') : '-'}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {t('webhookLastDelivery')}:{' '}
        {hook.lastDeliveryAt ? formatDateTimeMinute(hook.lastDeliveryAt) : t('webhookNoDelivery')}
      </div>
    </div>
  );
}
