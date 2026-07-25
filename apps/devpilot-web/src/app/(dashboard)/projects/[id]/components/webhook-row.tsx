/**
 * 单个 Webhook 行渲染
 *
 * 单一职责:展示一个 webhook(name/provider/token/events)+ 脱敏 reveal + 操作菜单。
 * token/secret 默认脱敏,reveal 走 A1 的轻量内联 toggle(本卡内自实现)。
 * 操作菜单收敛:编辑 / 轮换密钥 / 投递记录。
 */
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copyable, Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { ActionMenu } from '@/components/ui/action-menu';
import { formatDateTimeMinute } from '@/lib/format-date';
import { formatWebhookEvents } from '../utils/webhook-event-labels';
import type { ProjectWebhook } from '../types/operations';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface WebhookRowProps {
  hook: ProjectWebhook;
  onEdit: (hook: ProjectWebhook) => void;
  onRotate: (hook: ProjectWebhook) => void;
  onShowDeliveries: (hook: ProjectWebhook) => void;
}

/** URL Token 脱敏展示:首 4 + 末 4,中间用圆点替代,完整值仍可复制。 */
function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export function WebhookRow({ hook, onEdit, onRotate, onShowDeliveries }: WebhookRowProps) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const [revealed, setRevealed] = useState(false);
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
          <ActionMenu
            triggerLabel={tc('actions')}
            groups={[
              {
                items: [
                  { key: 'edit', label: tc('edit'), onSelect: () => onEdit(hook) },
                  {
                    key: 'deliveries',
                    label: t('webhookDeliveries'),
                    onSelect: () => onShowDeliveries(hook),
                  },
                ],
              },
              {
                items: [
                  {
                    key: 'rotate',
                    label: t('rotateSecret'),
                    onSelect: () => onRotate(hook),
                  },
                ],
              },
            ]}
          />
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('urlTokenLabel')}:</span>
        <Copyable text={hook.urlToken} copyText={t('copyUrlToken')} copiedText={t('copied')}>
          <span className="font-mono text-xs text-muted-foreground">
            {revealed ? hook.urlToken : maskToken(hook.urlToken)}
          </span>
        </Copyable>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="rounded px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
        >
          {revealed ? t('hideSecret') : t('revealSecret')}
        </button>
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        {t('webhookEvents')}: {formatWebhookEvents(eventTypes, t)}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {t('webhookLastDelivery')}:{' '}
        {hook.lastDeliveryAt ? formatDateTimeMinute(hook.lastDeliveryAt) : t('webhookNoDelivery')}
      </div>
    </div>
  );
}

/** 旧 maskToken 导出保留,供历史引用逐步迁移。 */
export { maskToken };
