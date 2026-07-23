/**
 * 基础信息分区
 *
 * 单一职责：渲染项目名称、默认分支、描述等基础信息输入。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Input, Textarea } from '@/components/ui';
import { SectionShell, type SectionProps } from './import-section-primitives';

export function BasicInfoSection({ form, onChange }: SectionProps) {
  const t = useTranslations('projectWizard');
  return (
    <SectionShell
      id="basic"
      title={t('basicInfoSectionTitle')}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('projectNameLabel')}</span>
          <Input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="customer-portal"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('defaultBranchLabel')}</span>
          <Input
            value={form.branch}
            onChange={(e) => onChange({ branch: e.target.value })}
            placeholder="main"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block font-medium">{t('descriptionLabel')}</span>
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t('descriptionPlaceholder')}
          />
        </label>
      </div>
    </SectionShell>
  );
}
