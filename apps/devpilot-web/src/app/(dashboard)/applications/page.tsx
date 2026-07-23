'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { Button, PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useApplications } from './hooks/use-applications';
import { ApplicationCard } from './components/application-card';
import { CreateAppModal } from './components/create-app-modal';
import { AddServiceModal } from './components/add-service-modal';
import { ApplicationsPageActions } from './components/applications-page-actions.component';
import { TypedSuspense as Suspense } from './components/suspense';
import type { ApplicationItem } from './types';

function ApplicationsContent() {
  const t = useTranslations('applications');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId') || '';
  const queryEnvironmentId = searchParams.get('environmentId') || '';
  const {
    applications,
    projects,
    environments,
    servers,
    sites,
    resources,
    loading,
    defaultProjectId,
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
    createApplication,
    createService,
    createDeploymentPlan,
    runServiceOperation,
    requestServiceOperationApproval,
    reload,
  } = useApplications(queryProjectId, queryEnvironmentId);

  const [appModalOpen, { setTrue: openAppModal, setFalse: closeAppModal }] = useBoolean(false);
  const [serviceAppId, setServiceAppId] = useState('');
  const serviceModalOpen = Boolean(serviceAppId);

  const handleRetry = usePersistFn(() => reload());
  const handleAddService = usePersistFn((app: ApplicationItem) => setServiceAppId(app.id));
  const handleCloseServiceModal = usePersistFn(() => setServiceAppId(''));

  // 添加服务弹窗预绑定应用 + 按其所属项目过滤的绑定选项。
  const serviceApplication =
    applications.find((a) => a.id === serviceAppId) || null;
  const serviceProjectId = serviceApplication?.projectId || '';
  const serviceEnvironments = environments.filter((e) => e.project?.id === serviceProjectId);
  const serviceSites = sites.filter((s) => !s.projectId || s.projectId === serviceProjectId);
  const serviceResources = resources.filter(
    (r) => !r.project?.id || r.project.id === serviceProjectId,
  );

  if (loading) return <LoadingState text={tc('loading')} />;

  const cardProps = {
    queryEnvironmentId,
    runningOperation,
    deployingServiceId,
    queueDeploymentRuns,
    queueServiceOperations,
    serviceSloRows,
    serviceSloLoading,
    onRunOperation: runServiceOperation,
    onRequestLive: requestServiceOperationApproval,
    onCreateDeployment: createDeploymentPlan,
    onAddService: handleAddService,
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
            onCreateApp={openAppModal}
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
        <MetricCard label={t('metricApps')} value={stats.applications} />
        <MetricCard label={t('metricServices')} value={stats.services} />
        <MetricCard label={t('metricEnvironments')} value={stats.environments} />
        <MetricCard label={t('metricDeployments')} value={stats.deployments} />
        <MetricCard label={t('metricOperations')} value={stats.operations} />
      </div>

      {visibleApplications.length === 0 ? (
        <EmptyState
          text={t('emptyAppsTitle')}
          description={t('emptyAppsHint')}
          action={
            <Button
              size="sm"
              onClick={openAppModal}
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

      <CreateAppModal
        open={appModalOpen}
        onClose={closeAppModal}
        onCreate={createApplication}
        projects={projects}
        defaultProjectId={defaultProjectId}
      />
      <AddServiceModal
        open={serviceModalOpen}
        onClose={handleCloseServiceModal}
        application={serviceApplication}
        environments={serviceEnvironments}
        servers={servers}
        sites={serviceSites}
        resources={serviceResources}
        onCreate={createService}
      />
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
