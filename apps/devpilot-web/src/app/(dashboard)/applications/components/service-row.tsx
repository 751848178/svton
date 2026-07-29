/**
 * 应用服务行
 *
 * 单一职责：渲染单个服务 + 状态/类型/环境徽章 + 操作（状态/日志/重启/回滚/部署）+ 最近部署/操作。
 */

'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { Button, StatusTag } from '@/components/ui';
import type {
  ApplicationItem,
  ApplicationServiceItem,
  CreatedDeploymentRun,
  ServiceAction,
  ServiceSloRow,
} from '../types';
import { ServiceSloSummary } from './service-slo-summary.component';
import { ServiceActionMenu } from './service-action-menu';
import { DeployRunStatusBadge } from './deploy-run-status-badge';
import { getKindLabel, getOperationLabel, getServiceStatusLabel } from '../utils';
import { ServiceRecentOperations } from './service-recent-operations';

interface ServiceRowProps {
  application: ApplicationItem;
  service: ApplicationServiceItem;
  focused: boolean;
  runningOperation: string;
  deployingServiceId: string;
  queueServiceOperations: boolean;
  serviceSloRows: Record<string, ServiceSloRow | null>;
  serviceSloLoading: boolean;
  /** 最近一次部署运行（来自向导创建结果 / 列表回填），用于内联状态展示。 */
  latestDeployRun?: CreatedDeploymentRun | null;
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
  /** 打开部署向导（取代原 fire-and-forget 的 onCreateDeployment）。 */
  onOpenDeploy: (application: ApplicationItem, service: ApplicationServiceItem) => void;
  onEditDeployment: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
  ) => void;
}

export function ServiceRow(props: ServiceRowProps) {
  const {
    application,
    service,
    runningOperation,
    deployingServiceId,
    queueServiceOperations,
    serviceSloRows,
    serviceSloLoading,
    latestDeployRun,
    focused,
  } = props;
  const { onRunOperation, onRequestLive, onOpenDeploy, onEditDeployment } = props;
  const t = useTranslations('applications');

  const handleRun = usePersistFn((action: ServiceAction) =>
    onRunOperation(application, service, action),
  );
  const handleLive = usePersistFn((action: ServiceAction) =>
    onRequestLive(application, service, action),
  );
  const handleDeploy = usePersistFn(() => onOpenDeploy(application, service));
  const handleEditDeployment = usePersistFn(() =>
    onEditDeployment(application, service),
  );
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) rowRef.current?.scrollIntoView({ block: 'center' });
  }, [focused]);

  return (
    <div
      ref={rowRef}
      id={`application-service-${service.id}`}
      className={`py-3 first:pt-0 last:pb-0 ${
        focused ? 'rounded-md bg-primary/5 px-3 ring-2 ring-primary/20' : ''
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{service.name}</span>
            <StatusTag
              status={service.status}
              label={getServiceStatusLabel(t, service.status)}
            />
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
          {latestDeployRun ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">{t('latestDeploy')}</span>
              <DeployRunStatusBadge run={latestDeployRun} />
              {latestDeployRun.operationApproval ? (
                <Link
                  href="/operation-approvals"
                  className="text-primary hover:underline"
                >
                  {t('goApprovals')} #{latestDeployRun.operationApproval.id.slice(0, 8)}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {/* L1：部署向导（唯一 primary 实心按钮，点击打开多步弹窗） */}
          <Button
            size="sm"
            onClick={handleDeploy}
            disabled={deployingServiceId === service.id}
          >
            {deployingServiceId === service.id ? t('generating') : t('deploy')}
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
            onEditDeployment={handleEditDeployment}
          />
        </div>
      </div>

      <ServiceSloSummary
        service={service}
        row={serviceSloRows[service.id]}
        loading={serviceSloLoading}
      />

      <ServiceRecentOperations service={service} />
    </div>
  );
}
