/**
 * 部署向导 - Step 1：环境选择
 *
 * 单一职责：渲染目标环境单选列表（默认选中服务当前环境）+ 服务/服务器上下文展示。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import type { ApplicationItem, ApplicationServiceItem, ProjectEnvironment } from '../../types';

interface DeployWizardEnvironmentStepProps {
  application: ApplicationItem;
  service: ApplicationServiceItem;
  environments: ProjectEnvironment[];
  selectedEnvironmentId: string;
  onSelect: (environmentId: string) => void;
}

export function DeployWizardEnvironmentStep({
  application,
  service,
  environments,
  selectedEnvironmentId,
  onSelect,
}: DeployWizardEnvironmentStepProps) {
  const t = useTranslations('applications');
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{service.name}</span>
          <Tag color="default">{application.name}</Tag>
          {service.server ? (
            <span className="text-xs text-muted-foreground">
              {service.server.name} ({service.server.host})
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('noServer')}</span>
          )}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('wizardSelectEnvironment')}</p>
        <div className="space-y-1">
          {environments.map((env) => (
            <label
              key={env.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                selectedEnvironmentId === env.id
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-accent'
              }`}
            >
              <input
                type="radio"
                name="deploy-environment"
                checked={selectedEnvironmentId === env.id}
                onChange={() => onSelect(env.id)}
                className="mt-0.5"
              />
              <span className="font-medium">{env.name}</span>
              <span className="text-xs text-muted-foreground">{env.key}</span>
            </label>
          ))}
          {environments.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('wizardNoEnvironments')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
