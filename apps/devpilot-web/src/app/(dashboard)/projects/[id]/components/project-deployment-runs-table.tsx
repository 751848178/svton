'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { Button, ErrorBanner } from '@/components/ui';
import {
  EMPTY_DEPLOYMENT_FILTERS,
  loadProjectDeploymentRun,
  useProjectDeploymentRuns,
} from '../hooks/use-project-deployment-runs';
import { useDeploymentRunFocusRestore } from '../hooks/use-deployment-run-focus-restore';
import { useReleaseOrders } from '../hooks/use-release-orders';
import type { ProjectEnvironment } from '../types';
import type { DeploymentRun } from '../types/operations';
import { deploymentRunReleaseOrderId } from '../utils/deployment-run-release-order.model';
import { releaseVersionIdentity } from '../utils/release-version-display.model';
import { ProjectDeploymentFilters } from './project-deployment-filters';
import { ProjectDeploymentRunDrawer } from './project-deployment-run-drawer';
import { ProjectDeploymentRunRow } from './project-deployment-run-row';
import {
  PROJECT_TABLE_CLASS,
  ProjectTableSurface,
  ProjectTableViewport,
} from './project-workbench-surface';
export function ProjectDeploymentRunsTable(props: {
  projectId: string;
  environments: ProjectEnvironment[];
  focusedRunId?: string;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orders = useReleaseOrders(props.projectId);
  const [filters, setFilters] = useState(EMPTY_DEPLOYMENT_FILTERS);
  const [page, setPage] = useState(0);
  const data = useProjectDeploymentRuns(props.projectId, filters, page);
  const [selected, setSelected] = useState<DeploymentRun | null>(null);
  const [focusedError, setFocusedError] = useState('');
  const focusRestore = useDeploymentRunFocusRestore(props.focusedRunId);
  const releaseOptions = useMemo(
    () =>
      orders.items.map((order) => ({
        id: order.id,
        label: releaseLabel(order.releaseVersion, order.releaseName),
      })),
    [orders.items],
  );

  useEffect(() => {
    if (!props.focusedRunId) {
      setSelected(null);
      return;
    }
    if (selected?.id === props.focusedRunId) return;
    const listed = data.items.find((run) => run.id === props.focusedRunId);
    if (listed) {
      setSelected(listed);
      return;
    }
    let active = true;
    loadProjectDeploymentRun(props.projectId, props.focusedRunId)
      .then((run) => {
        if (active) setSelected(run);
      })
      .catch((error) => {
        if (active) setFocusedError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [data.items, props.focusedRunId, props.projectId, selected?.id]);

  const setRunQuery = (run: DeploymentRun | null) => {
    if (run) setSelected(run);
    const next = new URLSearchParams(searchParams.toString());
    if (run) next.set('runId', run.id);
    else next.delete('runId');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const openRun = (run: DeploymentRun, trigger: HTMLButtonElement) => {
    focusRestore.remember(trigger);
    setRunQuery(run);
  };
  const closeRun = () => {
    setRunQuery(null);
  };
  return (
    <>
      <ProjectTableSurface
        title={t('deploymentRuns')}
        description={t('deploymentPanelDescription')}
        fillAvailableHeight
      >
        <ProjectDeploymentFilters
          value={filters}
          environments={props.environments}
          releases={releaseOptions}
          onChange={(next) => {
            setFilters(next);
            setPage(0);
          }}
        />
        {data.error || focusedError ? (
          <div className="p-4">
            <ErrorBanner
              message={data.error || focusedError}
              onRetry={data.reload}
            />
          </div>
        ) : null}
        {data.loading ? (
          <p className="flex-1 p-6 text-sm text-muted-foreground">{t('deploymentLoading')}</p>
        ) : data.items.length === 0 ? (
          <div className="flex-1 p-6">
            <EmptyState text={t('noDeploymentRuns')} />
          </div>
        ) : (
          <ProjectTableViewport label={t('deploymentRuns')}>
            <table className={`${PROJECT_TABLE_CLASS} min-w-[1080px]`}>
              <thead className="sticky top-0 z-10 bg-background">
                <tr>
                  <th>{t('deploymentColumnRun')}</th>
                  <th>{t('deploymentColumnVersion')}</th>
                  <th>{t('domainColumnEnvironment')}</th>
                  <th>{t('releaseOrderColumnStatus')}</th>
                  <th>{t('deploymentColumnDuration')}</th>
                  <th>{t('deploymentColumnActor')}</th>
                  <th className="text-right">{t('environmentVersionColumnAction')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((run) => {
                  const order = orders.items.find(
                    (item) => item.id === deploymentRunReleaseOrderId(run),
                  );
                  const version = order
                    ? releaseVersionIdentity(order.releaseVersion, order.releaseName)
                    : null;
                  const stage = run.releaseStageAttempts?.[0]?.releaseStage.name;
                  return (
                    <ProjectDeploymentRunRow
                      key={run.id}
                      run={run}
                      versionLabel={
                        version
                          ? version.name
                            ? `${version.name} ${version.version}`
                            : version.version
                          : '—'
                      }
                      stage={stage}
                      onSelect={(trigger) => openRun(run, trigger)}
                    />
                  );
                })}
              </tbody>
            </table>
          </ProjectTableViewport>
        )}
        <div className="flex shrink-0 items-center justify-between border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {t('deploymentPaginationPage', { page: page + 1 })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 0 || data.loading}
              onClick={() => setPage((value) => value - 1)}
            >
              {t('deploymentPaginationPrevious')}
            </Button>
            <Button
              variant="outline"
              disabled={!data.hasNext || data.loading}
              onClick={() => setPage((value) => value + 1)}
            >
              {t('deploymentPaginationNext')}
            </Button>
          </div>
        </div>
      </ProjectTableSurface>
      <ProjectDeploymentRunDrawer
        run={selected}
        projectId={props.projectId}
        onClose={closeRun}
        restoreFocusRef={focusRestore.triggerRef}
        restoreFocusSelector={focusRestore.selector}
      />
    </>
  );
}

function releaseLabel(releaseVersion: string, releaseName: string | null | undefined) {
  const identity = releaseVersionIdentity(releaseVersion, releaseName);
  return identity.name ? `${identity.name} ${identity.version}` : identity.version;
}
