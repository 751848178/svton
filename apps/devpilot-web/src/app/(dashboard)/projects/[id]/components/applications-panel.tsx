/** 项目应用面板。 */
'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { PanelGroup } from './panel-group';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

/** 服务状态值 → 本地化标签 key（避免 StatusTag 回退显示英文原值）。 */
function getServiceStatusLabelKey(status: string): string {
  const s = status.toLowerCase();
  if (s === 'active') return 'serviceStatusActive';
  if (s === 'inactive') return 'serviceStatusInactive';
  if (s === 'online') return 'serviceStatusOnline';
  if (s === 'offline') return 'serviceStatusOffline';
  return 'serviceStatusUnknown';
}

export function ApplicationsPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const p = detail.project;
  if (!p || !p.applications || p.applications.length === 0)
    return <EmptyState text={t('noLinkedApps')} />;
  return (
    <PanelGroup
      title={t('linkedApps')}
      subtitle={t('applicationsPanelDescription')}
    >
      <div className="space-y-3">
        {p.applications.map((app) => (
          <div
            key={app.id}
            className="rounded-md border p-3"
          >
            <div className="flex items-center justify-between">
              <Link
                href={`/applications?projectId=${p.id}`}
                className="font-medium text-primary hover:underline"
              >
                {app.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {t('serviceCount', { count: app._count?.services || 0 })}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(getApplicationScopeLabelKey(app.name, app.services?.map((svc) => svc.name) ?? []))}
            </p>
            {app.services && app.services.length > 0 && (
              <div className="mt-2 divide-y">
                {app.services.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span>{svc.name}</span>
                    <StatusTag
                      status={svc.status}
                      label={t(getServiceStatusLabelKey(svc.status))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </PanelGroup>
  );
}

function getApplicationScopeLabelKey(appName: string, serviceNames: string[]): string {
  const normalized = [appName, ...serviceNames].join(' ').toLowerCase();
  if (normalized.includes('proxy')) {
    return 'applicationScopeProxy';
  }
  return 'applicationScopeBusiness';
}
