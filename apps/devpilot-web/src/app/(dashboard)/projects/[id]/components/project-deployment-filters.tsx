'use client';

import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type { ProjectEnvironment } from '../types';
import type { ProjectDeploymentRunFilters } from '../hooks/use-project-deployment-runs';
import { getRunStatusLabelKey } from '../utils/run-labels';

export interface DeploymentReleaseOption {
  id: string;
  label: string;
}

export const PROJECT_DEPLOYMENT_STATUS_FILTERS = [
  'queued',
  'running',
  'blocked',
  'completed',
  'failed',
  'cancelled',
] as const;

export function ProjectDeploymentFilters(props: {
  value: ProjectDeploymentRunFilters;
  environments: ProjectEnvironment[];
  releases: DeploymentReleaseOption[];
  onChange: (value: ProjectDeploymentRunFilters) => void;
}) {
  const t = useTranslations('projects');
  const update = (patch: Partial<ProjectDeploymentRunFilters>) =>
    props.onChange({ ...props.value, ...patch });
  return (
    <div className="max-w-full shrink-0 overflow-x-auto overscroll-x-contain border-b sm:overflow-visible">
      <div className="grid min-w-max auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 p-4 sm:min-w-0 sm:grid-flow-row sm:grid-cols-2 xl:grid-cols-5">
        <Filter label={t('deploymentFilterEnvironment')}>
          <Select
            value={props.value.environmentId}
            onChange={(event) => update({ environmentId: event.target.value })}
          >
            <option value="">{t('deploymentFilterAll')}</option>
            {props.environments.map((environment) => (
              <option
                key={environment.id}
                value={environment.id}
              >
                {environment.name}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label={t('deploymentFilterStatus')}>
          <Select
            value={props.value.status}
            onChange={(event) => update({ status: event.target.value })}
          >
            <option value="">{t('deploymentFilterAll')}</option>
            {PROJECT_DEPLOYMENT_STATUS_FILTERS.map((status) => (
              <option
                key={status}
                value={status}
              >
                {t(getRunStatusLabelKey(status))}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label={t('deploymentFilterRelease')}>
          <Select
            value={props.value.releaseOrderId}
            onChange={(event) => update({ releaseOrderId: event.target.value })}
          >
            <option value="">{t('deploymentFilterAll')}</option>
            {props.releases.map((release) => (
              <option
                key={release.id}
                value={release.id}
              >
                {release.label}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label={t('deploymentFilterFrom')}>
          <Input
            type="date"
            value={props.value.startedFrom}
            onChange={(event) => update({ startedFrom: event.target.value })}
          />
        </Filter>
        <Filter label={t('deploymentFilterTo')}>
          <Input
            type="date"
            value={props.value.startedTo}
            onChange={(event) => update({ startedTo: event.target.value })}
          />
        </Filter>
      </div>
    </div>
  );
}

function Filter(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}
