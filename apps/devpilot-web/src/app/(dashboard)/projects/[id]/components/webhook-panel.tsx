/** 项目 Webhook 面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { Copyable, EmptyState, Tag } from '@svton/ui';
import { ErrorBanner, StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { ProjectWebhook } from '../types/operations';

type DetailHook = ReturnType<typeof useProjectDetail>;
type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

/** URL Token 脱敏展示：首 4 + 末 4，中间用圆点替代，完整值仍可复制。 */
function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export function WebhookPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  if (detail.webhookError) {
    return (
      <ErrorBanner
        message={detail.webhookError}
        onRetry={() => detail.loadWebhooks()}
      />
    );
  }
  if (detail.webhooks.length === 0) return <EmptyState text={t('noWebhooks')} />;
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold">{t('webhookTitle')}</h3>
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
        <span className="text-xs text-muted-foreground">{t('urlTokenLabel')}:</span>
        <Copyable
          text={hook.urlToken}
          copyText={t('copyUrlToken')}
          copiedText={t('copied')}
        >
          <span className="font-mono text-xs text-muted-foreground">{maskToken(hook.urlToken)}</span>
        </Copyable>
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
