/**
 * 添加服务表单 — 构建与部署分区
 *
 * 单一职责：渲染 workingDir/buildCmd/deployCmd/healthUrl 字段。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui';
import type { ServiceDeploymentForm } from '../types';
import { ServiceLifecycleFields } from './service-lifecycle-fields.component';

interface ServiceBuildFieldsProps {
  form: ServiceDeploymentForm;
  onChange: (patch: Partial<ServiceDeploymentForm>) => void;
}

export function ServiceBuildFields({ form, onChange }: ServiceBuildFieldsProps) {
  const t = useTranslations('applications');

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase text-muted-foreground">
        {t('sectionBuildDeploy')}
      </h3>
      <Input
        value={form.workingDirectory}
        onChange={(e) => onChange({ workingDirectory: e.target.value })}
        placeholder={t('workingDirPlaceholder')}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={form.buildCommand}
          onChange={(e) => onChange({ buildCommand: e.target.value })}
          placeholder={t('buildCommandPlaceholder')}
        />
        <Input
          value={form.deployCommand}
          onChange={(e) => onChange({ deployCommand: e.target.value })}
          placeholder={t('deployCommandPlaceholder')}
        />
      </div>
      <ServiceLifecycleFields
        form={form}
        onChange={onChange}
      />
      <Input
        value={form.healthCheckUrl}
        onChange={(e) => onChange({ healthCheckUrl: e.target.value })}
        placeholder={t('healthCheckUrlPlaceholder')}
      />
    </section>
  );
}
