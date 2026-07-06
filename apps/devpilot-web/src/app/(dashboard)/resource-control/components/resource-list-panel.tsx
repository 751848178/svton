/** 资源列表面板 - 受管资源卡片网格 + 筛选 + 同步/操作。 */
'use client';
import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState, Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useResourceControl } from '../hooks/use-resource-control';
import { kindLabels, providerLabels, statusClasses } from '../constants';
type RCHook = ReturnType<typeof useResourceControl>;

export function ResourceListPanel({ rc }: { rc: RCHook }) {
  const t = useTranslations('resourceControl');
  const tc = useTranslations('common');
  if (rc.loading) return <LoadingState text={tc('loading')} />;
  const filtered = rc.resources.filter(
    (r) =>
      (!rc.filterProvider || r.provider === rc.filterProvider) &&
      (!rc.filterKind || r.kind === rc.filterKind) &&
      (!rc.filterStatus || r.status === rc.filterStatus),
  );
  if (filtered.length === 0)
    return (
      <EmptyState
        text={t('noManagedResources')}
        description={t('noManagedResourcesDescription')}
      />
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={rc.filterProvider}
          onChange={(e) => rc.setFilterProvider(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('allProviders')}</option>
          {Object.keys(providerLabels).map((p) => (
            <option
              key={p}
              value={p}
            >
              {providerLabels[p]}
            </option>
          ))}
        </select>
        <select
          value={rc.filterKind}
          onChange={(e) => rc.setFilterKind(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('allKinds')}</option>
          {Object.keys(kindLabels).map((k) => (
            <option
              key={k}
              value={k}
            >
              {kindLabels[k]}
            </option>
          ))}
        </select>
        <select
          value={rc.filterStatus}
          onChange={(e) => rc.setFilterStatus(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="running">{t('statusRunning')}</option>
          <option value="stopped">{t('statusStopped')}</option>
          <option value="error">{t('statusError')}</option>
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((resource) => (
          <div
            key={resource.id}
            className="rounded-lg border p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium">{resource.name}</h3>
                <div className="mt-1 text-xs text-muted-foreground">
                  {providerLabels[resource.provider] || resource.provider}/
                  {kindLabels[resource.kind] || resource.kind}
                </div>
              </div>
              <StatusTag status={resource.status} />
            </div>
            {resource.endpoint && (
              <div className="mt-2 truncate font-mono text-xs text-muted-foreground">
                {resource.endpoint}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => rc.runAction(resource, 'sync')}
                disabled={rc.actingResourceId === `${resource.id}:sync`}
                className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
              >
                {rc.actingResourceId === `${resource.id}:sync` ? t('syncing') : t('sync')}
              </button>
              <button
                onClick={() => rc.runAction(resource, 'restart')}
                disabled={rc.actingResourceId === `${resource.id}:restart`}
                className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
              >
                {t('restart')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
