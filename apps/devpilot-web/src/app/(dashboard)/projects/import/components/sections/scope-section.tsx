/**
 * 接入方式分区
 *
 * 单一职责：渲染项目接入方式（完整纳管 / 仅构建部署 / 资源归属）单选卡片。
 */

'use client';

import { useTranslations } from 'next-intl';
import type { ImportProjectForm } from '../../types';
import { SectionShell, type SectionProps } from './import-section-primitives';

export function ScopeSection({ form, onChange }: SectionProps) {
  const t = useTranslations('projectWizard');
  const scopes: Array<{
    value: ImportProjectForm['managementScope'];
    title: string;
    desc: string;
  }> = [
    {
      value: 'full',
      title: t('scopeFullTitle'),
      desc: t('scopeFullDesc'),
    },
    {
      value: 'deployment',
      title: t('scopeDeploymentTitle'),
      desc: t('scopeDeploymentDesc'),
    },
    {
      value: 'resources',
      title: t('scopeResourcesTitle'),
      desc: t('scopeResourcesDesc'),
    },
  ];
  return (
    <SectionShell
      id="scope"
      title={t('scopeSectionTitle')}
    >
      <div className="grid gap-3 md:grid-cols-3">
        {scopes.map((scope) => (
          <label
            key={scope.value}
            className={`flex min-h-11 cursor-pointer items-center rounded-lg border p-4 transition-colors ${form.managementScope === scope.value ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
          >
            <input
              type="radio"
              name="managementScope"
              value={scope.value}
              checked={form.managementScope === scope.value}
              onChange={() => onChange({ managementScope: scope.value })}
              className="sr-only"
            />
            <span>
              <span className="block font-medium">{scope.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{scope.desc}</span>
            </span>
          </label>
        ))}
      </div>
    </SectionShell>
  );
}
