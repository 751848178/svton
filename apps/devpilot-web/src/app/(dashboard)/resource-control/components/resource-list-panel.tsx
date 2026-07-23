/** 资源列表面板 - 受管资源卡片网格 + 筛选 + 同步/操作。 */
'use client';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useResourceControl } from '../hooks/use-resource-control';
import { KIND_KEYS, PROVIDER_KEYS, resolveKindLabel, resolveProviderLabel } from '../constants';
import { listActionsForResource } from '../resource-action-ui.utils';
import { ResourceActionButtons } from './resource-action-buttons.component';
type RCHook = ReturnType<typeof useResourceControl>;

export function ResourceListPanel({ rc }: { rc: RCHook }) {
  const t = useTranslations('resourceControl');
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
          className="min-h-11 rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('allProviders')}</option>
          {PROVIDER_KEYS.map((p) => (
            <option
              key={p}
              value={p}
            >
              {resolveProviderLabel(p, t)}
            </option>
          ))}
        </select>
        <select
          value={rc.filterKind}
          onChange={(e) => rc.setFilterKind(e.target.value)}
          className="min-h-11 rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('allKinds')}</option>
          {KIND_KEYS.map((k) => (
            <option
              key={k}
              value={k}
            >
              {resolveKindLabel(k, t)}
            </option>
          ))}
        </select>
        <select
          value={rc.filterStatus}
          onChange={(e) => rc.setFilterStatus(e.target.value)}
          className="min-h-11 rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="running">{t('statusRunning')}</option>
          <option value="stopped">{t('statusStopped')}</option>
          <option value="error">{t('statusError')}</option>
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((resource) => (
          <ResourceCard
            key={resource.id}
            rc={rc}
            resource={resource}
          />
        ))}
      </div>
    </div>
  );
}

function ResourceCard({ rc, resource }: { rc: RCHook; resource: RCHook['resources'][number] }) {
  const t = useTranslations('resourceControl');
  const actions = listActionsForResource(rc.actions, resource);
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{resource.name}</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {resolveProviderLabel(resource.provider, t)}/
            {resolveKindLabel(resource.kind, t)}
          </div>
        </div>
        <StatusTag status={resource.status} />
      </div>
      {resource.endpoint && (
        <div className="mt-2 truncate font-mono text-xs text-muted-foreground">
          {resource.endpoint}
        </div>
      )}
      <ResourceActionButtons
        actions={actions}
        rc={rc}
        resource={resource}
      />
    </div>
  );
}
