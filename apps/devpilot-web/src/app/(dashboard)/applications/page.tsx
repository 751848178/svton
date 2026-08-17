'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { Button, PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useApplications } from './hooks/use-applications';
import { ApplicationCard } from './components/application-card';
import { ApplicationsPageActions } from './components/applications-page-actions.component';
import { useDeployWizardHost } from './components/deploy-wizard/deploy-wizard-host';
import { TypedSuspense as Suspense } from './components/suspense';
import { useApplicationsPageState } from './hooks/use-applications-page-state.hooks';
import { ApplicationsDialogs } from './components/applications-dialogs.component';

function ApplicationsContent() {
  const t = useTranslations('applications');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId') || '';
  const queryEnvironmentId = searchParams.get('environmentId') || '';
  const queryApplicationId = searchParams.get('applicationId') || '';
  const queryServiceId = searchParams.get('serviceId') || '';
  const data = useApplications(queryProjectId, queryEnvironmentId);
  const {
    applications,
    environments,
    sites,
    resources,
    loading,
    visibleApplications,
    stats,
    serviceSloRows,
    serviceSloLoading,
    serviceSloError,
    error,
    deployingServiceId,
    queueDeploymentRuns,
    setQueueDeploymentRuns,
    queueServiceOperations,
    setQueueServiceOperations,
    runningOperation,
    createDeploymentPlan,
    requestDeploymentApproval,
    runServiceOperation,
    requestServiceOperationApproval,
    reload,
  } = data;

  const pageState = useApplicationsPageState({
    shouldCreate: searchParams.get('create') === '1',
    deploymentDeepLink: searchParams.get('action') === 'edit-deployment' ? {
      projectId: queryProjectId,
      environmentId: queryEnvironmentId,
      serviceId: queryServiceId,
    } : null,
    applications,
    environments,
    sites,
    resources,
  });
  const deployHost = useDeployWizardHost({
    environments,
    operations: { createPlan: createDeploymentPlan, requestApproval: requestDeploymentApproval },
  });

  const handleRetry = usePersistFn(() => reload());
  if (loading) return <LoadingState text={tc('loading')} />;

  const cardProps = {
    queryEnvironmentId,
    focusedApplicationId: queryApplicationId,
    focusedServiceId: queryServiceId,
    runningOperation,
    deployingServiceId,
    queueDeploymentRuns,
    queueServiceOperations,
    serviceSloRows,
    serviceSloLoading,
    latestDeployRuns: deployHost.latestDeployRuns,
    onRunOperation: runServiceOperation,
    onRequestLive: requestServiceOperationApproval,
    onOpenDeploy: deployHost.onOpenDeploy,
    onAddService: pageState.handleAddService,
    onEditServiceDeployment: pageState.handleEditServiceDeployment,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <ApplicationsPageActions
            queueDeploymentRuns={queueDeploymentRuns}
            queueServiceOperations={queueServiceOperations}
            onQueueDeploymentRunsChange={setQueueDeploymentRuns}
            onQueueServiceOperationsChange={setQueueServiceOperations}
            onRefresh={handleRetry}
            onCreateApp={pageState.openAppModal}
          />
        }
      />

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={handleRetry}
        />
      ) : null}
      {serviceSloError ? (
        <p className="text-xs text-muted-foreground">
          {t('sloSummary')}: {serviceSloError}
          <button
            type="button"
            onClick={handleRetry}
            className="text-primary hover:underline ml-2"
          >
            {tc('retry')}
          </button>
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        <MetricCard
          label={t('metricApps')}
          value={stats.applications}
        />
        <MetricCard
          label={t('metricServices')}
          value={stats.services}
        />
        <MetricCard
          label={t('metricEnvironments')}
          value={stats.environments}
        />
        <MetricCard
          label={t('metricDeployments')}
          value={stats.deployments}
        />
        <MetricCard
          label={t('metricOperations')}
          value={stats.operations}
        />
      </div>

      {visibleApplications.length === 0 ? (
        <EmptyState
          text={t('emptyAppsTitle')}
          description={t('emptyAppsHint')}
          action={
            <Button
              size="sm"
              onClick={pageState.openAppModal}
            >
              + {t('newApp')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleApplications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              {...cardProps}
            />
          ))}
        </div>
      )}

      <ApplicationsDialogs data={data} pageState={pageState} deployHost={deployHost} />
    </div>
  );
}

export default function ApplicationsPage() {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<LoadingState text={tc('loading')} />}>
      <ApplicationsContent />
    </Suspense>
  );
}
