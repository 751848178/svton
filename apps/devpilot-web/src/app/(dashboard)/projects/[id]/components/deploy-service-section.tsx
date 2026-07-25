/**
 * 部署服务选择区（项目详情 Deployments tab 顶部）
 *
 * 单一职责：列出项目下所有 application→service，每行带「部署」按钮，
 * 点击交给父级 onOpenDeploy 打开内联 DeployWizardModal。
 *
 * 这是 A10 修复的核心入口 —— 替代原 header 跳转 /applications?projectId=X，
 * 让多服务项目在项目上下文内选服务。header 主「部署」按钮在单服务时直接打开向导，
 * 多服务时滚动到此 tab 并 toast 提示。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Button, StatusTag } from '@/components/ui';
import type { ProjectApplication, ProjectService } from '../types';
import { getServiceStatusLabelKey } from '../utils/run-labels';

interface DeployServiceSectionProps {
  applications: ProjectApplication[];
  onOpenDeploy: (application: ProjectApplication, service: ProjectService) => void;
}

export function DeployServiceSection({
  applications,
  onOpenDeploy,
}: DeployServiceSectionProps) {
  const t = useTranslations('projects');
  const handleDeploy = usePersistFn(onOpenDeploy);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold">{t('deployServiceTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('deployServiceDescription')}</p>
      </div>
      <div className="space-y-3">
        {applications.map((app) => (
          <div key={app.id} className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{app.name}</span>
              <span className="text-xs text-muted-foreground">
                {t('serviceCount', { count: app.services?.length ?? 0 })}
              </span>
            </div>
            {app.services && app.services.length > 0 ? (
              <div className="divide-y">
                {app.services.map((svc) => (
                  <ServiceDeployRow
                    key={svc.id}
                    service={svc}
                    onDeploy={() => handleDeploy(app, svc)}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('noServices')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

function ServiceDeployRow({
  service,
  onDeploy,
  t,
}: {
  service: ProjectService;
  onDeploy: () => void;
  t: ProjectsTranslator;
}) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <div className="min-w-0">
        <span className="font-medium">{service.name}</span>
        {service.environment ? (
          <span className="ml-2 text-xs text-muted-foreground">
            {service.environment.name}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <StatusTag
          status={service.status}
          label={(() => {
            const key = getServiceStatusLabelKey(service.status);
            return key ? t(key) : service.status;
          })()}
        />
        <Button size="sm" onClick={onDeploy}>
          {t('deploy')}
        </Button>
      </div>
    </div>
  );
}
