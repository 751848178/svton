/**
 * 仓库与技术栈分区
 *
 * 单一职责：渲染 Git provider、仓库地址、语言、框架、包管理器等输入。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import { SectionShell, SuggestionDatalist, type SectionProps } from './import-section-primitives';

export function RepoStackSection({ form, onChange }: SectionProps) {
  const t = useTranslations('projectWizard');
  return (
    <SectionShell
      id="repo-stack"
      title={t('repoStackSectionTitle')}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('gitProviderLabel')}</span>
          <Select
            value={form.provider}
            onChange={(e) => onChange({ provider: e.target.value })}
          >
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
            <option value="gitee">Gitee</option>
            <option value="custom">{t('gitProviderCustom')}</option>
            <option value="none">{t('gitProviderNone')}</option>
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('repoUrlLabel')}</span>
          <Input
            value={form.gitRepo}
            onChange={(e) => onChange({ gitRepo: e.target.value })}
            placeholder="https://github.com/acme/app"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('languageLabel')}</span>
          <Input
            list="import-language-suggestions"
            value={form.language}
            onChange={(e) => onChange({ language: e.target.value })}
            placeholder="TypeScript"
          />
          <SuggestionDatalist
            id="import-language-suggestions"
            options={['TypeScript', 'JavaScript', 'Java', 'Go', 'Python']}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('frameworkLabel')}</span>
          <Input
            list="import-framework-suggestions"
            value={form.framework}
            onChange={(e) => onChange({ framework: e.target.value })}
            placeholder="Next.js / NestJS / Spring Boot"
          />
          <SuggestionDatalist
            id="import-framework-suggestions"
            options={['Next.js', 'NestJS', 'Spring Boot', 'Express', 'Taro']}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('packageManagerLabel')}</span>
          <Input
            list="import-package-manager-suggestions"
            value={form.packageManager}
            onChange={(e) => onChange({ packageManager: e.target.value })}
            placeholder="pnpm / npm / yarn / maven"
          />
          <SuggestionDatalist
            id="import-package-manager-suggestions"
            options={['pnpm', 'npm', 'yarn', 'maven', 'gradle']}
          />
        </label>
      </div>
    </SectionShell>
  );
}
