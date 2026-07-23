/**
 * 应用卡片
 *
 * 单一职责：渲染单个应用 + 服务列表（委托 ServiceRow）。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
