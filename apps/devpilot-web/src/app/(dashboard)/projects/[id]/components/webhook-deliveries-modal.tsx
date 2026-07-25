/**
 * Webhook 投递记录弹窗
 *
 * 单一职责：调 GET:/project-webhooks/deliveries?webhookId=X 展示投递历史。
 * 后端 WebhookDelivery 字段:status/signatureStatus/eventType/message/receivedAt
 * + deploymentRun 关联。无响应码/耗时/重试字段(后端 schema 不含),展示可用维度。
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copyable, EmptyState, LoadingState } from '@svton/ui';
import { Modal, StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { WebhookDelivery } from '../types/operations';

export interface WebhookDeliveriesModalProps {
  open: boolean;
  webhook: { id: string; name: string } | null;
  loading: boolean;
  deliveries: WebhookDelivery[];
  onClose: () => void;
  /** 打开时触发取数。 */
  onOpen: (webhookId: string) => void;
}

const DELIVERY_STATUS_KEYS = ['received', 'accepted', 'ignored', 'failed'] as const;
const SIGNATURE_STATUS_KEYS = ['valid', 'invalid', 'missing', 'unchecked'] as const;

/** 已知 status 走 i18n,未知回退原值(避免缺失 key 抛错)。 */
function statusLabel(t: (k: string) => string, raw: string): string {
  return (DELIVERY_STATUS_KEYS as readonly string[]).includes(raw)
    ? t(`webhookDeliveryStatus.${raw}`)
    : raw;
}

function signatureLabel(t: (k: string) => string, raw: string): string {
  return (SIGNATURE_STATUS_KEYS as readonly string[]).includes(raw)
    ? t(`webhookSignatureStatusValue.${raw}`)
    : raw;
}

export function WebhookDeliveriesModal(props: WebhookDeliveriesModalProps) {
  const { open, webhook, loading, deliveries, onClose, onOpen } = props;
  const t = useTranslations('projects');

  useEffect(() => {
    if (open && webhook) onOpen(webhook.id);
  }, [open, webhook, onOpen]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('webhookDeliveriesTitle', { name: webhook?.name ?? '' })}
      width={680}
    >
      {loading ? (
        <LoadingState />
      ) : deliveries.length === 0 ? (
        <EmptyState text={t('webhookNoDelivery')} />
      ) : (
        <div className="space-y-2">
          {deliveries.map((d) => (
            <div
              key={d.id}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusTag status={d.status} label={statusLabel(t, d.status)} />
                  <span className="font-mono text-xs text-muted-foreground">{d.eventType}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTimeMinute(d.receivedAt)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t('webhookSignatureStatus')}: {signatureLabel(t, d.signatureStatus)}
                </span>
                {d.deploymentRun ? (
                  <span>
                    {t('webhookLinkedRun')}:{' '}
                    <span className="font-mono">{d.deploymentRun.id.slice(-8)}</span>
                    {d.deploymentRun.dryRun ? ` (${t('webhookDryRun')})` : ''}
                  </span>
                ) : null}
              </div>
              {d.message ? (
                <div className="mt-1 break-all rounded bg-muted/50 px-2 py-1 text-xs">
                  <Copyable text={d.message} copyText={t('copyUrlToken')} copiedText={t('copied')}>
                    <span>{d.message}</span>
                  </Copyable>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
