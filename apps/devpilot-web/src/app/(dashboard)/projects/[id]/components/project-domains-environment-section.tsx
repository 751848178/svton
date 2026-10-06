'use client';

import React, { useState } from 'react';
import { EmptyState } from '@svton/ui';
import { useTranslations } from 'next-intl';
import { Button, ConfirmDialog, ErrorBanner } from '@/components/ui';
import type { Site } from '@/app/(dashboard)/sites/types';
import { useSites } from '@/app/(dashboard)/sites/hooks/use-sites';
import { useEnvironmentConfigGovernance } from '../hooks/use-environment-config-governance';
import type { DeploymentRun } from '../types/operations';
import type { Project, ProjectEnvironment } from '../types';
import { ProjectTableSurface } from './project-workbench-surface';
import { ProjectDomainsTable } from './project-domains-table';
import { ProjectDomainWorkflowModal } from './project-domain-workflow-modal';
import { ProjectDomainDetailsDrawer } from './project-domain-details-drawer';
import { buildProjectDomainGapFacts } from './project-domain-gap.model';
import { ProjectDomainGapNotice } from './project-domain-gap-notice';

type ProjectDomainsEnvironmentProps = {
  project: Project;
  environment: ProjectEnvironment;
  items: Site[];
  runs: DeploymentRun[];
  sites: ReturnType<typeof useSites>;
  onProjectReload: () => void;
};

type DomainGovernance = ReturnType<typeof useEnvironmentConfigGovernance>;

export function ProjectDomainsEnvironmentSection(props: ProjectDomainsEnvironmentProps) {
  const governance = useEnvironmentConfigGovernance(
    props.environment,
    props.project.id,
    props.onProjectReload,
    false,
  );
  return (
    <ProjectDomainsEnvironmentContent
      {...props}
      governance={governance}
    />
  );
}

export function ProjectDomainsEnvironmentContent(
  props: ProjectDomainsEnvironmentProps & { governance: DomainGovernance },
) {
  const t = useTranslations('projects');
  const ts = useTranslations('sites');
  const [details, setDetails] = useState<Site | null>(null);
  const governance = props.governance;
  const productionGapFacts = buildProjectDomainGapFacts({
    sites: props.items,
    revision: governance.current,
    applications: props.project.applications ?? [],
    environmentId: props.environment.id,
  });
  const reload = () => {
    props.sites.reload();
    props.onProjectReload();
    governance.load();
  };
  const openDetails = (site: Site) => {
    setDetails(site);
    props.sites.handleCreatePlan(site.id);
  };
  return (
    <>
      {governance.error ? (
        <ErrorBanner
          message={governance.error}
          onRetry={governance.load}
        />
      ) : null}
      <ProjectTableSurface
        title={t('domainEntriesTitle')}
        description={t('domainEntriesDescription')}
        actions={
          <Button
            variant="outline"
            onClick={() => props.sites.setShowModal(true)}
          >
            + {t('addDomainEntry')}
          </Button>
        }
      >
        {!governance.loading &&
        props.items.length === 0 &&
        props.environment.baselineRole === 'production' ? (
          <ProjectDomainGapNotice
            facts={productionGapFacts}
            href={`/projects/${encodeURIComponent(props.project.id)}/settings?section=environments&env=${encodeURIComponent(props.environment.key)}&envTab=domains&new=true`}
          />
        ) : null}
        {props.items.length === 0 ? (
          <div className="p-6">
            <EmptyState text={t('domainsEmpty')} />
          </div>
        ) : (
          <ProjectDomainsTable
            items={props.items}
            revision={governance.current}
            applications={props.project.applications ?? []}
            onOpen={openDetails}
            onEdit={props.sites.setEditTarget}
            onDelete={props.sites.handleDelete}
          />
        )}
      </ProjectTableSurface>
      {props.sites.showModal || props.sites.editTarget ? (
        <ProjectDomainWorkflowModal
          projectId={props.project.id}
          projectName={props.project.name}
          environment={props.environment}
          applications={props.project.applications ?? []}
          sites={props.sites.sites}
          currentRevision={governance.current}
          site={props.sites.editTarget}
          saveRevision={governance.save}
          onChanged={reload}
          onClose={() => {
            props.sites.setShowModal(false);
            props.sites.setEditTarget(null);
            if (props.sites.editTarget) reload();
          }}
          onSuccess={() => {
            props.sites.setShowModal(false);
            props.sites.setEditTarget(null);
            reload();
          }}
        />
      ) : null}
      <ProjectDomainDetailsDrawer
        site={details}
        projectId={props.project.id}
        environment={props.environment}
        applications={props.project.applications ?? []}
        revision={governance.current}
        runs={props.runs}
        plan={details ? props.sites.plans[details.id] : undefined}
        loadingPlan={Boolean(details && props.sites.planningId === details.id)}
        onClose={() => setDetails(null)}
      />
      <ConfirmDialog
        open={Boolean(props.sites.deleteTarget)}
        onOpenChange={(open) => {
          if (!open) props.sites.cancelDelete();
        }}
        tone="danger"
        title={ts('deleteSiteTitle')}
        description={
          props.sites.deleteTarget
            ? ts('deleteSiteDescription', { name: props.sites.deleteTarget.name })
            : undefined
        }
        confirmLabel={ts('deleteSiteTitle')}
        onConfirm={props.sites.confirmDelete}
      />
    </>
  );
}
