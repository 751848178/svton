/**
 * 项目接入表单分区组件
 *
 * 单一职责：渲染各分区（接入方式/基础信息/仓库技术栈/构建部署/环境）。
 */

import { useTranslations } from 'next-intl';
import type { ImportProjectForm, DeploymentTarget, EnvironmentKey } from '../types';
import { ENVIRONMENT_OPTIONS } from '../types';

const INPUT_CLASS =
  'w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

interface SectionProps {
  form: ImportProjectForm;
  onChange: (patch: Partial<ImportProjectForm>) => void;
  onToggleEnvironment: (env: EnvironmentKey) => void;
}

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
    <section className="rounded-lg border p-6">
      <h2 className="font-semibold">{t('scopeSectionTitle')}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {scopes.map((scope) => (
          <label
            key={scope.value}
            className={`cursor-pointer rounded-lg border p-4 ${form.managementScope === scope.value ? 'border-primary bg-primary/5' : ''}`}
          >
            <input
              type="radio"
              name="managementScope"
              value={scope.value}
              checked={form.managementScope === scope.value}
              onChange={() => onChange({ managementScope: scope.value })}
              className="sr-only"
            />
            <span className="font-medium">{scope.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{scope.desc}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export function BasicInfoSection({ form, onChange }: SectionProps) {
  const t = useTranslations('projectWizard');
  return (
    <section className="rounded-lg border p-6">
      <h2 className="font-semibold">{t('basicInfoSectionTitle')}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('projectNameLabel')}</span>
          <input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className={INPUT_CLASS}
            placeholder="customer-portal"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('defaultBranchLabel')}</span>
          <input
            value={form.branch}
            onChange={(e) => onChange({ branch: e.target.value })}
            className={INPUT_CLASS}
            placeholder="main"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block font-medium">{t('descriptionLabel')}</span>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className={INPUT_CLASS}
            rows={3}
            placeholder={t('descriptionPlaceholder')}
          />
        </label>
      </div>
    </section>
  );
}

export function RepoStackSection({ form, onChange }: SectionProps) {
  const t = useTranslations('projectWizard');
  return (
    <section className="rounded-lg border p-6">
      <h2 className="font-semibold">{t('repoStackSectionTitle')}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('gitProviderLabel')}</span>
          <select
            value={form.provider}
            onChange={(e) => onChange({ provider: e.target.value })}
            className={INPUT_CLASS}
          >
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
            <option value="gitee">Gitee</option>
            <option value="custom">{t('gitProviderCustom')}</option>
            <option value="none">{t('gitProviderNone')}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('repoUrlLabel')}</span>
          <input
            value={form.gitRepo}
            onChange={(e) => onChange({ gitRepo: e.target.value })}
            className={INPUT_CLASS}
            placeholder="https://github.com/acme/app"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('languageLabel')}</span>
          <input
            value={form.language}
            onChange={(e) => onChange({ language: e.target.value })}
            className={INPUT_CLASS}
            placeholder="TypeScript"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('frameworkLabel')}</span>
          <input
            value={form.framework}
            onChange={(e) => onChange({ framework: e.target.value })}
            className={INPUT_CLASS}
            placeholder="Next.js / NestJS / Spring Boot"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('packageManagerLabel')}</span>
          <input
            value={form.packageManager}
            onChange={(e) => onChange({ packageManager: e.target.value })}
            className={INPUT_CLASS}
            placeholder="pnpm / npm / yarn / maven"
          />
        </label>
      </div>
    </section>
  );
}

export function DeploySection({ form, onChange }: SectionProps) {
  const t = useTranslations('projectWizard');
  return (
    <section className="rounded-lg border p-6">
      <h2 className="font-semibold">{t('deploySectionTitle')}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('deployTargetLabel')}</span>
          <select
            value={form.deploymentTarget}
            onChange={(e) => onChange({ deploymentTarget: e.target.value as DeploymentTarget })}
            className={INPUT_CLASS}
          >
            <option value="docker-compose">{t('deployTargetDockerCompose')}</option>
            <option value="server">{t('deployTargetServer')}</option>
            <option value="kubernetes">{t('deployTargetKubernetes')}</option>
            <option value="external-ci">{t('deployTargetExternalCi')}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('workingDirectoryLabel')}</span>
          <input
            value={form.workingDirectory}
            onChange={(e) => onChange({ workingDirectory: e.target.value })}
            className={INPUT_CLASS}
            placeholder="/srv/apps/customer-portal"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('buildCommandLabel')}</span>
          <input
            value={form.buildCommand}
            onChange={(e) => onChange({ buildCommand: e.target.value })}
            className={INPUT_CLASS}
            placeholder="pnpm build"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('deployCommandLabel')}</span>
          <input
            value={form.deployCommand}
            onChange={(e) => onChange({ deployCommand: e.target.value })}
            className={INPUT_CLASS}
            placeholder="docker compose up -d --build"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block font-medium">{t('healthCheckUrlLabel')}</span>
          <input
            value={form.healthCheckUrl}
            onChange={(e) => onChange({ healthCheckUrl: e.target.value })}
            className={INPUT_CLASS}
            placeholder="https://example.com/health"
          />
        </label>
      </div>
    </section>
  );
}

export function EnvironmentSection({ form, onToggleEnvironment }: SectionProps) {
  const t = useTranslations('projectWizard');
  return (
    <section className="rounded-lg border p-6">
      <h2 className="font-semibold">{t('environmentSectionTitle')}</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {ENVIRONMENT_OPTIONS.map((environment) => (
          <label
            key={environment.id}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={form.environments.includes(environment.id)}
              onChange={() => onToggleEnvironment(environment.id)}
            />
            {environment.label}
          </label>
        ))}
      </div>
    </section>
  );
}
