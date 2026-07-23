/**
 * 构建部署分区
 *
 * 单一职责：渲染部署目标、工作目录、构建/部署命令、健康检查地址等输入。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type { DeploymentTarget } from '../../types';
import { SectionShell, type SectionProps } from './import-section-primitives';

export function DeploySection({ form, onChange }: SectionProps) {
  const t = useTranslations('projectWizard');
  return (
    <SectionShell
      id="deploy"
      title={t('deploySectionTitle')}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('deployTargetLabel')}</span>
          <Select
            value={form.deploymentTarget}
            onChange={(e) => onChange({ deploymentTarget: e.target.value as DeploymentTarget })}
          >
            <option value="docker-compose">{t('deployTargetDockerCompose')}</option>
            <option value="server">{t('deployTargetServer')}</option>
            <option value="kubernetes">{t('deployTargetKubernetes')}</option>
            <option value="external-ci">{t('deployTargetExternalCi')}</option>
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('workingDirectoryLabel')}</span>
          <Input
            value={form.workingDirectory}
            onChange={(e) => onChange({ workingDirectory: e.target.value })}
            placeholder="/srv/apps/customer-portal"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('buildCommandLabel')}</span>
          <Input
            value={form.buildCommand}
            onChange={(e) => onChange({ buildCommand: e.target.value })}
            placeholder="pnpm build"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('deployCommandLabel')}</span>
          <Input
            value={form.deployCommand}
            onChange={(e) => onChange({ deployCommand: e.target.value })}
            placeholder="docker compose up -d --build"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block font-medium">{t('healthCheckUrlLabel')}</span>
          <Input
            value={form.healthCheckUrl}
            onChange={(e) => onChange({ healthCheckUrl: e.target.value })}
            placeholder="https://example.com/health"
          />
        </label>
      </div>
    </SectionShell>
  );
}
