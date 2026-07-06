/**
 * 应用服务行
 *
 * 单一职责：渲染单个服务 + 状态/类型/环境徽章 + 操作（状态/日志/重启/回滚/部署）+ 最近操作。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type {
  ApplicationItem,
  ApplicationServiceItem,
  ServiceAction,
  ServiceSloRow,
} from '../types';
import { kindLabels, operationLabels, SERVICE_ACTIONS } from '../constants';
import { ServiceSloSummary } from './service-slo-summary.component';
import { getOperationStatusLabel, formatDate } from '../utils';

interface ServiceRowProps {
  application: ApplicationItem;
  service: ApplicationServiceItem;
  runningOperation: string;
  deployingServiceId: string;
  queueDeploymentRuns: boolean;
  queueServiceOperations: boolean;
  serviceSloRows: Record<string, ServiceSloRow | null>;
  serviceSloLoading: boolean;
  onRunOperation: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    action: ServiceAction,
  ) => void;
  onRequestLive: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    action: ServiceAction,
  ) => void;
  onCreateDeployment: (application: ApplicationItem, service: ApplicationServiceItem) => void;
}

export function ServiceRow(props: ServiceRowProps) {
  const {
    application,
    service,
    runningOperation,
    deployingServiceId,
    queueDeploymentRuns,
    queueServiceOperations,
    serviceSloRows,
    serviceSloLoading,
  } = props;
  const { onRunOperation, onRequestLive, onCreateDeployment } = props;
  const t = useTranslations('applications');

  const handleRun = usePersistFn((action: ServiceAction) =>
    onRunOperation(application, service, action),
  );
  const handleLive = usePersistFn((action: ServiceAction) =>
    onRequestLive(application, service, action),
  );
  const handleDeploy = usePersistFn(() => onCreateDeployment(application, service));

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{service.name}</span>
            <StatusTag status={service.status} />
            <Tag color="default">{kindLabels[service.kind] || service.kind}</Tag>
            <Tag color="default">{service.environment?.name || t('noEnv')}</Tag>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {service.server ? `${service.server.name} (${service.server.host})` : t('noServer')}
            {service.site ? ` · ${service.site.primaryDomain}` : ''}
            {service.managedResource ? ` · ${service.managedResource.name}` : ''}
          </div>
          {service.runtime ? (
            <div className="mt-1 text-xs text-muted-foreground">runtime: {service.runtime}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {SERVICE_ACTIONS.map((action) => {
            const isRunning = runningOperation === `${service.id}:${action}`;
            const isRequestingLive = runningOperation === `${service.id}:${action}:live`;
            const canRequestLive = action === 'restart' || action === 'rollback';
            const actionLabel = operationLabels[action] || action;
            const planLabel = queueServiceOperations
              ? t('operationEnqueue', { label: actionLabel })
              : actionLabel;
            const liveLabel = queueServiceOperations ? t('requestEnqueue') : t('requestLive');
            return (
              <div
                key={action}
                className="flex gap-1"
              >
                <button
                  onClick={() => handleRun(action)}
                  disabled={isRunning}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                >
                  {isRunning ? t('generating') : planLabel}
                </button>
                {canRequestLive ? (
                  <button
                    onClick={() => handleLive(action)}
                    disabled={isRequestingLive}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {isRequestingLive ? t('requesting') : liveLabel}
                  </button>
                ) : null}
              </div>
            );
          })}
          <button
            onClick={handleDeploy}
            disabled={deployingServiceId === service.id}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {deployingServiceId === service.id
              ? queueDeploymentRuns
                ? t('enqueuing')
                : t('generating')
              : queueDeploymentRuns
                ? t('joinDeployQueue')
                : t('generateDeployPlan')}
          </button>
        </div>
      </div>

      <ServiceSloSummary
        service={service}
        row={serviceSloRows[service.id]}
        loading={serviceSloLoading}
      />

      {service.operationRuns && service.operationRuns.length > 0 ? (
        <div className="mt-3 rounded-md bg-muted/50 p-3">
          <div className="text-xs font-medium text-muted-foreground">{t('recentOps')}</div>
          <div className="mt-2 space-y-2">
            {service.operationRuns.slice(0, 3).map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{operationLabels[run.action] || run.action}</span>
                  <StatusTag
                    status={run.status}
                    label={getOperationStatusLabel(run.status)}
                  />
                  <span className="text-muted-foreground">{run.dryRun ? 'Dry-run' : 'Live'}</span>
                  {run.serverExecutionJob ? (
                    <Link
                      href="/execution-governance"
                      className="text-primary hover:underline"
                    >
                      Job {run.serverExecutionJob.id.slice(0, 8)} ·{' '}
                      {getOperationStatusLabel(run.serverExecutionJob.status)}
                    </Link>
                  ) : null}
                  {run.error ? <span className="text-destructive">{run.error}</span> : null}
                </div>
                <span className="text-muted-foreground">{formatDate(run.startedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
