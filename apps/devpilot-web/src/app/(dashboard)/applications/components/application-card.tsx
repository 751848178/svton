/**
 * 应用卡片
 *
 * 单一职责：渲染单个应用 + 服务列表（委托 ServiceRow）+ 卡片底部的「添加服务」入口。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ApplicationItem, CreatedDeploymentRun, ServiceAction, ServiceSloRow } from '../types';
import { ServiceRow } from './service-row';

/** 加号图标（内联，避免引入 icon 依赖）。 */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

interface ApplicationCardProps {
  application: ApplicationItem;
  queryEnvironmentId: string;
  runningOperation: string;
  deployingServiceId: string;
  queueDeploymentRuns: boolean;
  queueServiceOperations: boolean;
  serviceSloRows: Record<string, ServiceSloRow | null>;
  serviceSloLoading: boolean;
  /** 各服务最近一次部署运行（serviceId → run），用于服务行内联状态展示。 */
  latestDeployRuns?: Record<string, CreatedDeploymentRun | null>;
  onRunOperation: (
    application: ApplicationItem,
    service: ApplicationItem['services'][number],
    action: ServiceAction,
  ) => void;
  onRequestLive: (
    application: ApplicationItem,
    service: ApplicationItem['services'][number],
    action: ServiceAction,
  ) => void;
  /** 打开部署向导（取代原 fire-and-forget 的 onCreateDeployment）。 */
  onOpenDeploy: (
    application: ApplicationItem,
    service: ApplicationItem['services'][number],
  ) => void;
  /** 卡片底部「添加服务」按钮：打开预绑定到该应用的添加服务弹窗。 */
  onAddService: (application: ApplicationItem) => void;
}

export function ApplicationCard(props: ApplicationCardProps) {
  const { application, queryEnvironmentId, onAddService } = props;
  const t = useTranslations('applications');
  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{application.name}</h3>
            <Link
              href={`/projects/${application.projectId}`}
              className={
                application.project?.name
                  ? 'text-xs font-medium text-primary hover:underline'
                  : 'text-xs text-muted-foreground hover:underline'
              }
            >
              {application.project?.name || t('unnamedProject')}
            </Link>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {application.repositoryUrl || t('noRepo')}
            {application.defaultBranch ? ` · ${application.defaultBranch}` : ''}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{t('serviceCount', { count: application._count?.services || 0 })}</div>
          <div>
            {t('runCount', {
              count:
                (application._count?.deploymentRuns || 0) +
                (application._count?.operationRuns || 0),
            })}
          </div>
        </div>
      </div>

      {application.services.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {queryEnvironmentId ? t('noContextServices') : t('noServices')}
        </p>
      ) : (
        <div className="mt-4 divide-y">
          {application.services.map((service) => (
            <ServiceRow
              key={service.id}
              application={application}
              service={service}
              runningOperation={props.runningOperation}
              deployingServiceId={props.deployingServiceId}
              queueServiceOperations={props.queueServiceOperations}
              serviceSloRows={props.serviceSloRows}
              serviceSloLoading={props.serviceSloLoading}
              latestDeployRun={props.latestDeployRuns?.[service.id] ?? null}
              onRunOperation={props.onRunOperation}
              onRequestLive={props.onRequestLive}
              onOpenDeploy={props.onOpenDeploy}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddService(application)}
        >
          <PlusIcon className="h-4 w-4" />
          {t('addService')}
        </Button>
      </div>
    </div>
  );
}
