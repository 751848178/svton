'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { Button, ConfirmDialog, ErrorBanner, Select } from '@/components/ui';
import { AddSiteModal } from '@/app/(dashboard)/sites/components/add-site-modal';
import { EditSiteModal } from '@/app/(dashboard)/sites/components/edit-site-modal';
import { useSites } from '@/app/(dashboard)/sites/hooks/use-sites';
import { useProjectDetail } from '../hooks/use-project-detail';
import { selectExistingProjectEnvironments } from '../utils/project-environment-list';
import { ProjectContextIssue } from './project-context-issue';
import { ProjectDomainsConfigPreview } from './project-domains-config-preview';
import { ProjectDomainsTable } from './project-domains-table';
import { ProjectWorkbenchHeader } from './project-workbench-header';

export function ProjectDomainsRoute() {
  const t = useTranslations('projects');
  const ts = useTranslations('sites');
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const detail = useProjectDetail(projectId);
  const [environmentId, setEnvironmentId] = useState(searchParams.get('environmentId') || '');
  const [previewSiteId, setPreviewSiteId] = useState<string | null>(null);
  const sites = useSites(projectId, '', '', searchParams.get('new') === 'true');
  const environments = selectExistingProjectEnvironments(detail.project?.environments);
  const activeEnvironmentId = environments.some((item) => item.id === environmentId)
    ? environmentId
    : environments[0]?.id || '';
  const filtered = useMemo(
    () =>
      sites.sites.filter(
        (site) => !activeEnvironmentId || site.environment?.id === activeEnvironmentId,
      ),
    [activeEnvironmentId, sites.sites],
  );
  if (detail.loading || sites.loading) return <LoadingState />;
  const project = detail.project;
  if (!project)
    return (
      <ErrorBanner
        message={detail.error || t('projectNotFound')}
        onRetry={detail.loadProject}
      />
    );
  const activeEnvironment = environments.find((item) => item.id === activeEnvironmentId);
  return (
    <div className="space-y-6">
      <ProjectWorkbenchHeader
        projectId={projectId}
        name={project.name}
      />
      {filtered.length === 0 && activeEnvironment?.baselineRole === 'production' ? (
        <ProjectContextIssue
          message={t('productionEntryMissing')}
          actionLabel={t('addDomainEntry')}
          href={`/projects/${encodeURIComponent(projectId)}/domains?new=true&environmentId=${encodeURIComponent(activeEnvironmentId)}`}
        />
      ) : null}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{t('domainsPageTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('domainsPageDescription')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              className="w-auto bg-background"
              value={activeEnvironmentId}
              onChange={(event) => setEnvironmentId(event.target.value)}
            >
              {environments.map((environment) => (
                <option
                  key={environment.id}
                  value={environment.id}
                >
                  {environment.name} ({environment.key})
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              onClick={() => sites.setShowModal(true)}
            >
              + {t('addDomainEntry')}
            </Button>
          </div>
        </div>
        {sites.error ? (
          <ErrorBanner
            message={sites.error}
            onRetry={sites.reload}
          />
        ) : null}
        {filtered.length === 0 ? (
          <EmptyState text={t('domainsEmpty')} />
        ) : (
          <ProjectDomainsTable
            items={filtered}
            onEdit={sites.setEditTarget}
            onPlan={(id) => {
              // DOM-3：预览配置必须打开可见的预览弹层，而非只后台拉取计划。
              setPreviewSiteId(id);
              sites.handleCreatePlan(id);
            }}
            onDelete={sites.handleDelete}
            planningSiteId={previewSiteId && sites.planningId === previewSiteId ? previewSiteId : null}
          />
        )}
      </section>
      {sites.showModal ? (
        <AddSiteModal
          servers={sites.servers}
          projects={sites.projects.filter((item) => item.id === projectId)}
          projectEnvironments={environments.map((item) => ({ ...item, projectId }))}
          proxyConfigs={sites.proxyConfigs}
          defaultProjectId={projectId}
          defaultEnvironmentId={activeEnvironmentId}
          lockedContext={{
            projectName: project.name,
            environmentName: activeEnvironment?.name || activeEnvironmentId,
          }}
          onClose={() => sites.setShowModal(false)}
          onSuccess={() => {
            sites.setShowModal(false);
            sites.reload();
          }}
        />
      ) : null}
      {sites.editTarget ? (
        <EditSiteModal
          site={sites.editTarget}
          servers={sites.servers}
          projects={sites.projects.filter((item) => item.id === projectId)}
          projectEnvironments={environments.map((item) => ({ ...item, projectId }))}
          proxyConfigs={sites.proxyConfigs}
          lockedContext={{
            projectId,
            projectName: project.name,
            environmentId: sites.editTarget.environment?.id || activeEnvironmentId,
            environmentName:
              sites.editTarget.environment?.name || activeEnvironment?.name || activeEnvironmentId,
          }}
          onClose={() => sites.setEditTarget(null)}
          onSuccess={() => {
            sites.setEditTarget(null);
            sites.reload();
          }}
        />
      ) : null}
      {previewSiteId ? (
        <ProjectDomainsConfigPreview
          open
          site={filtered.find((item) => item.id === previewSiteId)}
          plan={sites.plans[previewSiteId]}
          loading={sites.planningId === previewSiteId}
          onClose={() => setPreviewSiteId(null)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(sites.deleteTarget)}
        onOpenChange={(open) => {
          if (!open) sites.cancelDelete();
        }}
        tone="danger"
        title={ts('deleteSiteTitle')}
        description={
          sites.deleteTarget
            ? ts('deleteSiteDescription', { name: sites.deleteTarget.name })
            : undefined
        }
        confirmLabel={ts('deleteSiteTitle')}
        onConfirm={sites.confirmDelete}
      />
    </div>
  );
}
