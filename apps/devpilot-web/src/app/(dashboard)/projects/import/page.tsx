'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { ProjectManagementScope, ProjectOrigin } from '@/lib/project-display';

type OnboardingOrigin = Exclude<ProjectOrigin, 'generated'>;
type DeploymentTarget = 'server' | 'docker-compose' | 'kubernetes' | 'external-ci';
type EnvironmentKey = 'dev' | 'test' | 'staging' | 'prod';

interface CreatedProject {
  id: string;
}

interface ImportProjectForm {
  managementScope: ProjectManagementScope;
  name: string;
  description: string;
  gitRepo: string;
  branch: string;
  provider: string;
  language: string;
  framework: string;
  packageManager: string;
  deploymentTarget: DeploymentTarget;
  workingDirectory: string;
  buildCommand: string;
  deployCommand: string;
  healthCheckUrl: string;
  environments: EnvironmentKey[];
}

const environmentOptions: Array<{ id: EnvironmentKey; label: string }> = [
  { id: 'dev', label: '开发' },
  { id: 'test', label: '测试' },
  { id: 'staging', label: '预发' },
  { id: 'prod', label: '生产' },
];
const defaultEnvironmentKeys: EnvironmentKey[] = environmentOptions.map((option) => option.id);

const inputClassName =
  'w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

const initialForm: ImportProjectForm = {
  managementScope: 'full',
  name: '',
  description: '',
  gitRepo: '',
  branch: 'main',
  provider: 'github',
  language: '',
  framework: '',
  packageManager: '',
  deploymentTarget: 'docker-compose',
  workingDirectory: '',
  buildCommand: '',
  deployCommand: '',
  healthCheckUrl: '',
  environments: defaultEnvironmentKeys,
};

function trimmed(value: string): string | undefined {
  const next = value.trim();
  return next ? next : undefined;
}

function buildStackProfile(form: ImportProjectForm): Record<string, string> {
  return Object.fromEntries(
    [
      ['language', trimmed(form.language)],
      ['framework', trimmed(form.framework)],
      ['packageManager', trimmed(form.packageManager)],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function getOriginForScope(scope: ProjectManagementScope): OnboardingOrigin {
  return scope === 'resources' ? 'external' : 'imported';
}

function buildDeploymentConfig(form: ImportProjectForm): Record<string, string | boolean> {
  return Object.fromEntries(
    [
      ['enabled', form.managementScope === 'full' || form.managementScope === 'deployment'],
      ['targetType', form.deploymentTarget],
      ['workingDirectory', trimmed(form.workingDirectory)],
      ['buildCommand', trimmed(form.buildCommand)],
      ['deployCommand', trimmed(form.deployCommand)],
      ['healthCheckUrl', trimmed(form.healthCheckUrl)],
    ].filter((entry): entry is [string, string | boolean] => entry[1] !== undefined),
  );
}

export default function ImportProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState<ImportProjectForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateField = <K extends keyof ImportProjectForm>(key: K, value: ImportProjectForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleEnvironment = (environment: EnvironmentKey) => {
    setForm((current) => {
      const exists = current.environments.includes(environment);
      if (exists && current.environments.length === 1) return current;

      return {
        ...current,
        environments: exists
          ? current.environments.filter((item) => item !== environment)
          : [...current.environments, environment],
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const name = form.name.trim();
    if (!name) {
      setError('请填写项目名称');
      return;
    }

    setSubmitting(true);
    try {
      const gitRepo = trimmed(form.gitRepo);
      const stackProfile = buildStackProfile(form);
      const origin = getOriginForScope(form.managementScope);
      const config: Record<string, unknown> = {
        origin,
        mode: origin,
        managementScope: form.managementScope,
        projectName: name,
        description: trimmed(form.description),
        initialized: false,
        environments: form.environments,
        source: {
          type: origin === 'imported' ? (gitRepo ? 'git' : 'manual') : 'external',
          provider: trimmed(form.provider),
          repository: gitRepo,
          branch: trimmed(form.branch),
        },
        onboarding: {
          status: 'connected',
          initializer: 'skipped',
          scope: form.managementScope,
          connectedAt: new Date().toISOString(),
        },
      };

      if (Object.keys(stackProfile).length > 0) {
        config.stackProfile = stackProfile;
      }

      if (form.managementScope !== 'resources') {
        config.deployment = buildDeploymentConfig(form);
      }

      const project = await api.post<CreatedProject>('/projects', {
        name,
        description: trimmed(form.description),
        gitRepo,
        origin,
        config,
      });

      router.push(`/projects/${project.id}`);
    } catch (submitError) {
      console.error('Failed to import project:', submitError);
      setError(submitError instanceof Error ? submitError.message : '接入项目失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">接入已有项目</h1>
          <p className="text-muted-foreground">创建一个不依赖初始化器的项目管控入口</p>
        </div>
        <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
          返回项目列表
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-lg border p-6">
          <h2 className="font-semibold">接入方式</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label
              className={`rounded-lg border p-4 cursor-pointer ${
                form.managementScope === 'full' ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <input
                type="radio"
                name="managementScope"
                value="full"
                checked={form.managementScope === 'full'}
                onChange={() => updateField('managementScope', 'full')}
                className="sr-only"
              />
              <span className="font-medium">已有代码项目</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                可关联 Git 仓库，后续绑定部署、资源和 Webhook。
              </span>
            </label>

            <label
              className={`rounded-lg border p-4 cursor-pointer ${
                form.managementScope === 'deployment' ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <input
                type="radio"
                name="managementScope"
                value="deployment"
                checked={form.managementScope === 'deployment'}
                onChange={() => updateField('managementScope', 'deployment')}
                className="sr-only"
              />
              <span className="font-medium">仅构建部署</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                只接入仓库、构建命令、部署命令和健康检查。
              </span>
            </label>

            <label
              className={`rounded-lg border p-4 cursor-pointer ${
                form.managementScope === 'resources' ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <input
                type="radio"
                name="managementScope"
                value="resources"
                checked={form.managementScope === 'resources'}
                onChange={() => updateField('managementScope', 'resources')}
                className="sr-only"
              />
              <span className="font-medium">外部管控项目</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                不要求代码仓库，只作为服务器、站点和云资源的归属。
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-lg border p-6">
          <h2 className="font-semibold">基础信息</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">项目名称</label>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className={inputClassName}
                placeholder="customer-portal"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">默认分支</label>
              <input
                value={form.branch}
                onChange={(event) => updateField('branch', event.target.value)}
                className={inputClassName}
                placeholder="main"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">描述</label>
              <textarea
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                className={inputClassName}
                rows={3}
                placeholder="项目用途、归属业务或接入范围"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-6">
          <h2 className="font-semibold">仓库与技术栈</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Git Provider</label>
              <select
                value={form.provider}
                onChange={(event) => updateField('provider', event.target.value)}
                className={inputClassName}
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="gitee">Gitee</option>
                <option value="custom">自建 Git</option>
                <option value="none">不关联</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">仓库地址</label>
              <input
                value={form.gitRepo}
                onChange={(event) => updateField('gitRepo', event.target.value)}
                className={inputClassName}
                placeholder="https://github.com/acme/app"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">语言</label>
              <input
                value={form.language}
                onChange={(event) => updateField('language', event.target.value)}
                className={inputClassName}
                placeholder="TypeScript"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">框架</label>
              <input
                value={form.framework}
                onChange={(event) => updateField('framework', event.target.value)}
                className={inputClassName}
                placeholder="Next.js / NestJS / Spring Boot"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">包管理器</label>
              <input
                value={form.packageManager}
                onChange={(event) => updateField('packageManager', event.target.value)}
                className={inputClassName}
                placeholder="pnpm / npm / yarn / maven"
              />
            </div>
          </div>
        </section>

        {form.managementScope !== 'resources' && (
          <section className="rounded-lg border p-6">
            <h2 className="font-semibold">构建部署</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">部署目标</label>
                <select
                  value={form.deploymentTarget}
                  onChange={(event) => updateField('deploymentTarget', event.target.value as DeploymentTarget)}
                  className={inputClassName}
                >
                  <option value="docker-compose">Docker Compose</option>
                  <option value="server">服务器脚本</option>
                  <option value="kubernetes">Kubernetes</option>
                  <option value="external-ci">外部 CI</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">工作目录</label>
                <input
                  value={form.workingDirectory}
                  onChange={(event) => updateField('workingDirectory', event.target.value)}
                  className={inputClassName}
                  placeholder="/srv/apps/customer-portal"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">构建命令</label>
                <input
                  value={form.buildCommand}
                  onChange={(event) => updateField('buildCommand', event.target.value)}
                  className={inputClassName}
                  placeholder="pnpm build"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">部署命令</label>
                <input
                  value={form.deployCommand}
                  onChange={(event) => updateField('deployCommand', event.target.value)}
                  className={inputClassName}
                  placeholder="docker compose up -d --build"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">健康检查地址</label>
                <input
                  value={form.healthCheckUrl}
                  onChange={(event) => updateField('healthCheckUrl', event.target.value)}
                  className={inputClassName}
                  placeholder="https://example.com/health"
                />
              </div>
            </div>
          </section>
        )}

        <section className="rounded-lg border p-6">
          <h2 className="font-semibold">环境</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {environmentOptions.map((environment) => (
              <label
                key={environment.id}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.environments.includes(environment.id)}
                  onChange={() => toggleEnvironment(environment.id)}
                />
                {environment.label}
              </label>
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/projects"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? '接入中...' : '完成接入'}
          </button>
        </div>
      </form>
    </div>
  );
}
