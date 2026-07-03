'use client';

import { Suspense as ReactSuspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useApplications } from './hooks/use-applications';
import { CreateAppForm } from './components/create-app-form';
import { CreateServiceForm } from './components/create-service-form';
import { ApplicationCard } from './components/application-card';
import { ApplicationsPageActions } from './components/applications-page-actions.component';

// React 19 类型下 Suspense 跨包 JSX 校验差异，用类型断言绕过（TS2786）
const Suspense = ReactSuspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => JSX.Element;

function ApplicationsContent() {
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
    saving,
    deployingServiceId,
    queueDeploymentRuns,
    setQueueDeploymentRuns,
    queueServiceOperations,
    setQueueServiceOperations,
    runningOperation,
    error,
    appForm,
    setAppForm,
    serviceForm,
    setServiceForm,
    visibleApplications,
    stats,
    serviceSloRows,
    serviceSloLoading,
    serviceSloError,
    createApplication,
    createService,
    createDeploymentPlan,
    runServiceOperation,
    requestServiceOperationApproval,
    reload,
  } = useApplications(queryProjectId, queryEnvironmentId);

  const handleRetry = usePersistFn(() => reload());
  const selectedApp = applications.find((a) => a.id === serviceForm.applicationId);
  const serviceProjectId = selectedApp?.projectId || appForm.projectId;
  const applicationOptions = queryProjectId
    ? applications.filter((a) => a.projectId === queryProjectId)
    : applications;
  const serviceEnvironments = environments.filter((e) => e.project?.id === serviceProjectId);
  const serviceSites = sites.filter(
    (s) =>
      (!s.projectId || s.projectId === serviceProjectId) &&
      (!s.environmentId ||
        !serviceForm.environmentId ||
        s.environmentId === serviceForm.environmentId),
  );
  const serviceResources = resources.filter(
    (r) =>
      (!r.project?.id || r.project.id === serviceProjectId) &&
      (!r.environment?.id ||
        !serviceForm.environmentId ||
        r.environment.id === serviceForm.environmentId),
  );

  if (loading) return <LoadingState text="加载中..." />;

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
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="应用服务"
        description="以服务为单位组织环境、服务器、站点、资源和部署配置"
        actions={
          <ApplicationsPageActions
            queueDeploymentRuns={queueDeploymentRuns}
            queueServiceOperations={queueServiceOperations}
            onQueueDeploymentRunsChange={setQueueDeploymentRuns}
            onQueueServiceOperationsChange={setQueueServiceOperations}
            onRefresh={handleRetry}
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
        <ErrorBanner
          message={serviceSloError}
          onRetry={handleRetry}
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="应用"
          value={stats.applications}
        />
        <MetricCard
          label="服务"
          value={stats.services}
        />
        <MetricCard
          label="涉及环境"
          value={stats.environments}
        />
        <MetricCard
          label="部署/操作"
          value={stats.deployments + stats.operations}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <CreateAppForm
            form={appForm}
            onChange={setAppForm}
            projects={projects}
            saving={saving}
            onCreate={createApplication}
          />
          <CreateServiceForm
            form={serviceForm}
            onChange={setServiceForm}
            applications={applicationOptions}
            environments={serviceEnvironments}
            servers={servers}
            sites={serviceSites}
            resources={serviceResources}
            saving={saving}
            onCreate={createService}
          />
        </div>

        <section className="rounded-lg border p-4">
          <h2 className="font-semibold">服务工作区</h2>
          {visibleApplications.length === 0 ? (
            <EmptyState
              text="暂无当前上下文应用"
              description="先创建一个应用并添加环境服务"
            />
          ) : (
            <div className="mt-4 space-y-4">
              {visibleApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  {...cardProps}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<LoadingState text="加载中..." />}>
      <ApplicationsContent />
    </Suspense>
  );
}
