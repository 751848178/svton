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
import { Button, StatusTag } from '@/components/ui';
import type {
  ApplicationItem,
  ApplicationServiceItem,
  ServiceAction,
  ServiceSloRow,
} from '../types';
import { ServiceSloSummary } from './service-slo-summary.component';
import { ServiceActionMenu } from './service-action-menu';
import { getKindLabel, getOperationLabel, getOperationStatusLabel, formatDate } from '../utils';

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
            <Tag color="default">{getKindLabel(t, service.kind)}</Tag>
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

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {/* L1：部署（唯一 primary 实心按钮，视觉强调） */}
          <Button
            size="sm"
            onClick={handleDeploy}
            disabled={deployingServiceId === service.id}
          >
            {deployingServiceId === service.id
              ? queueDeploymentRuns
                ? t('enqueuing')
                : t('generating')
              : queueDeploymentRuns
                ? t('joinDeployQueue')
                : t('generateDeployPlan')}
          </Button>
          {/* L2：状态查询（高频只读操作，outline 外露） */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRun('status')}
            disabled={runningOperation === `${service.id}:status`}
          >
            {runningOperation === `${service.id}:status`
              ? t('generating')
              : queueServiceOperations
                ? t('operationEnqueue', { label: getOperationLabel(t, 'status') })
                : getOperationLabel(t, 'status')}
          </Button>
          {/* 其余操作收敛进菜单：日志/重启/回滚 × 计划环境 + 重启/回滚 × 申请 Live */}
          <ServiceActionMenu
            serviceId={service.id}
            runningOperation={runningOperation}
            queueServiceOperations={queueServiceOperations}
            onRun={handleRun}
            onRequestLive={handleLive}
          />
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
                  <span className="font-medium">{getOperationLabel(t, run.action)}</span>
                  <StatusTag
                    status={run.status}
                    label={getOperationStatusLabel(t, run.status)}
                  />
                  <span className="text-muted-foreground">
                    {run.dryRun ? t('modeDryRun') : t('modeLive')}
                  </span>
                  {run.serverExecutionJob ? (
                    <Link
                      href="/execution-governance"
                      className="text-primary hover:underline"
                    >
                      {t('jobLabel')} #{run.serverExecutionJob.id.slice(0, 8)} ·{' '}
                      {getOperationStatusLabel(t, run.serverExecutionJob.status)}
                    </Link>
                  ) : null}
                  {run.error ? (
                    <span
                      className="max-w-[16rem] truncate text-destructive"
                      title={run.error}
                    >
                      {run.error}
                    </span>
                  ) : null}
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
