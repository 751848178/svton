/** 项目部署运行面板。 */
'use client';
import React, { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { Alert, ErrorBanner, Select } from '@/components/ui';
import { DeployServiceSection } from './deploy-service-section';
import { DeploymentRunList } from './deployment-run-list';
import { PanelGroup } from './panel-group';
import type { ProjectApplication, ProjectService } from '../types';
import type { useProjectDetail } from '../hooks/use-project-detail';
import {
  applyDeploymentRunFilters,
  deploymentRunFilterOptions,
  deploymentRunFiltersActive,
  parseDeploymentRunFilters,
  type DeploymentRunFilters,
} from '../utils/deployment-run-filters.model';
import { getRunSourceLabelKey, getRunStatusLabelKey } from '../utils/run-labels';
import { releaseEnvironmentValueLabelKey } from '../utils/release-copy.model';
type DetailHook = ReturnType<typeof useProjectDetail>;

const INITIAL_VISIBLE = 10;

interface DeploymentPanelProps {
  detail: DetailHook;
  focusedRunId?: string;
  /** 打开内联部署向导（项目域 app/service）。无值时回退到运行历史视图。 */
  onOpenDeploy?: (application: ProjectApplication, service: ProjectService) => void;
}

export function DeploymentPanel({ detail, focusedRunId, onOpenDeploy }: DeploymentPanelProps) {
  const t = useTranslations('projects');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  const showDeploySection = Boolean(onOpenDeploy && detail.project?.applications?.length);
  const filters = parseDeploymentRunFilters(searchParams);
  const allRuns = detail.deploymentRuns;
  const filteredRuns = deploymentRunFiltersActive(filters)
    ? applyDeploymentRunFilters(allRuns, filters)
    : allRuns;
  const focusedRuns = focusedRunId
    ? filteredRuns.filter((run) => run.id === focusedRunId)
    : filteredRuns;

  /** 筛选/聚焦状态写入 URL（替换而非追加），刷新与分享可恢复。 */
  const updateQuery = (patch: Partial<DeploymentRunFilters> & { runId?: null }) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    const assignments: Array<[string, string | undefined]> = [
      ['runEnv', patch.environment],
      ['runStatus', patch.status],
      ['runSource', patch.source],
      ['runSort', patch.sort],
      ['runId', patch.runId === null ? '' : undefined],
    ];
    for (const [key, value] of assignments) {
      if (value === undefined) continue;
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const clearFocus = () => updateQuery({ runId: null });

  const runsPanel = (
    <PanelGroup
      title={t('deploymentRuns')}
      subtitle={t('deploymentPanelDescription')}
    >
      {focusedRunId ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Alert tone="info">
            {t('focusedDeploymentRun', { id: focusedRunId })}
            <span className="ml-1 font-mono text-xs">{focusedRunId}</span>
          </Alert>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs text-primary hover:bg-accent"
            onClick={clearFocus}
          >
            {t('focusedDeploymentRunClear')}
          </button>
        </div>
      ) : null}
      {detail.deploymentError ? (
        <ErrorBanner
          message={detail.deploymentError}
          onRetry={() => detail.loadDeploymentRuns()}
        />
      ) : focusedRuns.length === 0 ? (
        <EmptyState
          text={focusedRunId ? t('focusedDeploymentRunNotFound') : t('noDeploymentRuns')}
        />
      ) : (
        <>
          {!focusedRunId && allRuns.length > 0 ? (
            <DeploymentRunFiltersBar
              filters={filters}
              options={deploymentRunFilterOptions(allRuns)}
              onChange={(patch) => updateQuery(patch)}
              onReset={() => updateQuery({ environment: '', status: '', source: '' })}
            />
          ) : null}
          {deploymentRunFiltersActive(filters) && !focusedRunId ? (
            <p className="text-xs text-muted-foreground">
              {t('deploymentRunFilterSummary', {
                visible: filteredRuns.length,
                total: allRuns.length,
              })}
            </p>
          ) : null}
          <DeploymentRunList
            projectId={detail.project?.id ?? ''}
            runs={focusedRuns}
            visibleCount={INITIAL_VISIBLE}
            expanded={Boolean(focusedRunId) || expanded}
            focusedRunId={focusedRunId}
            onToggle={setExpanded}
          />
        </>
      )}
    </PanelGroup>
  );

  if (!showDeploySection) return runsPanel;

  return (
    <div className="space-y-4">
      <DeployServiceSection
        applications={detail.project!.applications!}
        onOpenDeploy={onOpenDeploy!}
      />
      {runsPanel}
    </div>
  );
}

function DeploymentRunFiltersBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: DeploymentRunFilters;
  options: ReturnType<typeof deploymentRunFilterOptions>;
  onChange: (patch: Partial<DeploymentRunFilters>) => void;
  onReset: () => void;
}) {
  const t = useTranslations('projects');
  const selectClass = 'w-auto bg-background';
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="deployment-run-filters">
      <Select
        size="sm"
        aria-label={t('deploymentRunFilterEnvironment')}
        className={selectClass}
        value={filters.environment}
        onChange={(event) => onChange({ environment: event.target.value })}
      >
        <option value="">{t('deploymentRunFilterEnvironmentAll')}</option>
        {options.environments.map((env) => {
          const labelKey = releaseEnvironmentValueLabelKey(env);
          return (
            <option key={env} value={env}>
              {labelKey ? t(labelKey as never) : env}
            </option>
          );
        })}
      </Select>
      <Select
        size="sm"
        aria-label={t('deploymentRunFilterStatus')}
        className={selectClass}
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value })}
      >
        <option value="">{t('deploymentRunFilterStatusAll')}</option>
        {options.statuses.map((status) => (
          <option key={status} value={status}>
            {t(getRunStatusLabelKey(status))}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        aria-label={t('deploymentRunFilterSource')}
        className={selectClass}
        value={filters.source}
        onChange={(event) => onChange({ source: event.target.value })}
      >
        <option value="">{t('deploymentRunFilterSourceAll')}</option>
        {options.sources.map((source) => {
          const labelKey = getRunSourceLabelKey(source);
          return (
            <option key={source} value={source}>
              {labelKey ? t(labelKey) : source}
            </option>
          );
        })}
      </Select>
      <Select
        size="sm"
        aria-label={t('deploymentRunFilterSort')}
        className={selectClass}
        value={filters.sort}
        onChange={(event) =>
          onChange({ sort: event.target.value === 'earliest' ? 'earliest' : 'latest' })
        }
      >
        <option value="latest">{t('deploymentRunFilterSortLatest')}</option>
        <option value="earliest">{t('deploymentRunFilterSortEarliest')}</option>
      </Select>
      {deploymentRunFiltersActive(filters) ? (
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs text-primary hover:bg-accent"
          onClick={onReset}
        >
          {t('deploymentRunFilterReset')}
        </button>
      ) : null}
    </div>
  );
}
