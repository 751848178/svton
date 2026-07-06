'use client';

import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState, Tag } from '@svton/ui';
import { PageHeader, StatusTag } from '@/components/ui';
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
  const { instances, loading, release } = useResourceInstances(initialInstances);

  const releaseInstance = async (id: string) => {
    if (!confirm(t('releaseConfirm'))) return;
    await release(id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
      />

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
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t('sourceRequest', { title: instance.request.title })}
                    </div>
                  ) : null}
                </div>
                {instance.status === 'active' ? (
                  <button
                    onClick={() => releaseInstance(instance.id)}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    {t('release')}
                  </button>
                ) : null}
              </div>
              {instance.delivery && Object.keys(instance.delivery).length > 0 ? (
                <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(instance.delivery, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
