/**
 * 应用卡片
 *
 * 单一职责：渲染单个应用 + 服务列表（委托 ServiceRow）。
 */

import { Tag } from '@svton/ui';
import type { ApplicationItem, ServiceAction, ServiceSloRow } from '../types';
import { ServiceRow } from './service-row';

interface ApplicationCardProps {
  application: ApplicationItem;
  queryEnvironmentId: string;
  runningOperation: string;
  deployingServiceId: string;
  queueDeploymentRuns: boolean;
  queueServiceOperations: boolean;
  serviceSloRows: Record<string, ServiceSloRow | null>;
  serviceSloLoading: boolean;
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
  onCreateDeployment: (
    application: ApplicationItem,
    service: ApplicationItem['services'][number],
  ) => void;
}

export function ApplicationCard(props: ApplicationCardProps) {
  const { application, queryEnvironmentId } = props;
  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{application.name}</h3>
            <Tag color="default">{application.project?.name || application.projectId}</Tag>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {application.repositoryUrl || '未绑定仓库'}
            {application.defaultBranch ? ` · ${application.defaultBranch}` : ''}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{application._count?.services || 0} 个服务</div>
          <div>
            {(application._count?.deploymentRuns || 0) + (application._count?.operationRuns || 0)}{' '}
            次运行
          </div>
        </div>
      </div>

      {application.services.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {queryEnvironmentId ? '暂无当前环境服务' : '暂无服务'}
        </p>
      ) : (
        <div className="mt-4 divide-y">
          {application.services.map((service) => (
            <ServiceRow
              key={service.id}
              {...props}
              application={application}
              service={service}
            />
          ))}
        </div>
      )}
    </div>
  );
}
