'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState, Tag } from '@svton/ui';
import { PageHeader, StatusTag, ErrorBanner } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { feedback } from '@/components/ui/feedback/feedback';
import { useResourceInstances } from '../hooks/use-resource-instances';
import { STATUS_LABELS, type ResourceInstance } from '../types';

/**
 * 资源实例客户端视图。
 *
 * 接收首屏 server 数据 initialInstances（SWR fallback），释放动作在此完成。
 */
export function ResourceInstancesContent({
  initialInstances,
}: {
  initialInstances?: ResourceInstance[];
}) {
  const t = useTranslations('resourceInstances');
  const tc = useTranslations('common');
  const { instances, loading, loadError, release } = useResourceInstances(initialInstances);
  // 释放确认弹窗状态（一个操作一个确认实例）
  const [releaseTarget, setReleaseTarget] = useState<ResourceInstance | null>(null);

  const handleConfirmRelease = usePersistFn(async () => {
    if (!releaseTarget) return;
    try {
      await release(releaseTarget.id);
      setReleaseTarget(null);
      feedback.success(t('releaseSuccess'));
    } catch (error) {
      console.error('Failed to release resource instance:', error);
      feedback.error(t('releaseFailed'));
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
      />

      {loadError ? <ErrorBanner message={t('loadFailed')} /> : null}

      {loading ? (
        <LoadingState text={tc('loading')} />
      ) : instances.length === 0 ? (
        <EmptyState
          text={t('noInstances')}
          description={t('noInstancesHint')}
        />
      ) : (
        <div className="grid gap-4">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className="rounded-lg border p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{instance.name}</h3>
                    <StatusTag
                      status={instance.status}
                      label={STATUS_LABELS[instance.status]}
                    />
                    {instance.hasCredentials ? <Tag color="default">{t('hasCredentials')}</Tag> : null}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {instance.resourceType?.name || '-'} · {instance.project?.name || t('notAssociatedProject')}
                  </div>
                  {instance.request ? (
                    <div className="mt-1 text-xs">
                      <Link
                        href="/resource-requests"
                        className="text-primary hover:underline"
                      >
                        {t('sourceRequest', { title: instance.request.title })}
                      </Link>
                    </div>
                  ) : null}
                </div>
                {instance.status === 'active' ? (
                  <button
                    onClick={() => setReleaseTarget(instance)}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    {t('release')}
                  </button>
                ) : null}
              </div>
              {instance.delivery && Object.keys(instance.delivery).length > 0 ? (
                <dl className="mt-3 space-y-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {Object.entries(instance.delivery).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex gap-2"
                    >
                      <dt className="shrink-0 font-medium text-muted-foreground">{key}:</dt>
                      <dd className="break-all font-mono">{formatDeliveryValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(releaseTarget)}
        onOpenChange={(open) => {
          if (!open) setReleaseTarget(null);
        }}
        tone="danger"
        title={t('releaseConfirmTitle')}
        description={t('releaseConfirm')}
        confirmLabel={t('release')}
        cancelLabel={tc('cancel')}
        onConfirm={handleConfirmRelease}
      />
    </div>
  );
}

/** 交付字段值格式化：对象/数组 JSON 序列化该行，其余转字符串，保证整行可选中复制。 */
function formatDeliveryValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
