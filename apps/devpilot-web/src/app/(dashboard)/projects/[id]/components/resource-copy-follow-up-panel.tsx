/** Resource copy 后续接管入口。 */
'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState, Tag } from '@svton/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { ProjectManagedResource } from '../types';
import {
  buildResourceControlHref,
  buildResourceCopyAuditHref,
  buildResourceMetricAlertHref,
  listEnvironmentManagedResources,
} from '../utils/resource-copy-follow-up';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ResourceCopyFollowUpPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const project = detail.project;
  const environments = project?.environments || [];
  const resources = project?.managedResources || [];

  if (!project || environments.length === 0) {
    return <EmptyState text={t('noResourceCopyEntry')} />;
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">{t('resourceCopyFollowUp')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('resourceCopyFollowUpDesc')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PanelLink href={buildResourceCopyAuditHref(project.id)}>{t('projectResourceCopyAudit')}</PanelLink>
          <PanelLink href={buildResourceControlHref(project.id)}>{t('projectResourceControl')}</PanelLink>
          <PanelLink href={buildResourceMetricAlertHref(project.id)}>{t('projectResourceAlert')}</PanelLink>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {environments.map((environment) => (
          <EnvironmentResourceFollowUpRow
            key={environment.id}
            projectId={project.id}
            environmentId={environment.id}
            environmentName={environment.name}
            environmentKey={environment.key}
            managedResourceCount={environment._count?.managedResources || 0}
            secretKeyCount={environment._count?.secretKeys || 0}
            resources={listEnvironmentManagedResources(resources, environment.id)}
          />
        ))}
      </div>
    </div>
  );
}

function EnvironmentResourceFollowUpRow({
  projectId,
  environmentId,
  environmentName,
  environmentKey,
  managedResourceCount,
  secretKeyCount,
  resources,
}: {
  projectId: string;
  environmentId: string;
  environmentName: string;
  environmentKey: string;
  managedResourceCount: number;
  secretKeyCount: number;
  resources: ProjectManagedResource[];
}) {
  const t = useTranslations('projects');
  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{environmentName}</div>
          <div className="mt-1 text-xs text-muted-foreground">{environmentKey}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Tag color={managedResourceCount > 0 ? 'cyan' : 'default'}>
            {t('resourceCount', { count: managedResourceCount })}
          </Tag>
          <Tag color={secretKeyCount > 0 ? 'purple' : 'default'}>
            {t('secretCount', { count: secretKeyCount })}
          </Tag>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <PanelLink href={buildResourceCopyAuditHref(projectId, environmentId)}>{t('resourceCopyAudit')}</PanelLink>
        <PanelLink href={buildResourceControlHref(projectId, environmentId)}>{t('resourceControl')}</PanelLink>
        <PanelLink href={buildResourceMetricAlertHref(projectId, environmentId)}>{t('metricAlert')}</PanelLink>
      </div>
      {resources.length > 0 ? (
        <div className="mt-3 space-y-2">
          {resources.slice(0, 3).map((resource) => (
            <ResourceFollowUpLine
              key={resource.id}
              projectId={projectId}
              environmentId={environmentId}
              resource={resource}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResourceFollowUpLine({
  projectId,
  environmentId,
  resource,
}: {
  projectId: string;
  environmentId: string;
  resource: ProjectManagedResource;
}) {
  const t = useTranslations('projects');
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
      <div className="min-w-0">
        <div className="truncate font-medium">{resource.name}</div>
        <div className="truncate text-muted-foreground">
          {resource.provider}/{resource.kind} · {resource.status}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <PanelLink href={buildResourceControlHref(projectId, environmentId, resource.id)}>
          {t('control')}
        </PanelLink>
        <PanelLink href={buildResourceMetricAlertHref(projectId, environmentId, resource.id)}>
          {t('alert')}
        </PanelLink>
      </div>
    </div>
  );
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded border px-2 py-1 text-xs hover:bg-accent">
      {children}
    </Link>
  );
}
