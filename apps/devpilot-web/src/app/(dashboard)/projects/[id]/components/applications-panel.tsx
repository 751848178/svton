/** 项目应用面板。 */
'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

export function ApplicationsPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const p = detail.project;
  if (!p || !p.applications || p.applications.length === 0)
    return <EmptyState text={t('noLinkedApps')} />;
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 font-semibold">{t('linkedApps')}</h2>
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
            {app.services && app.services.length > 0 && (
              <div className="mt-2 divide-y">
                {app.services.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span>{svc.name}</span>
                    <StatusTag status={svc.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
