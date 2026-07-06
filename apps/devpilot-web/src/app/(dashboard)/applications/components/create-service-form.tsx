/**
 * 添加服务表单
 *
 * 单一职责：收集服务字段（环境/类型/绑定/部署配置）并提交。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import type {
  ServiceForm,
  ApplicationItem,
  ProjectEnvironment,
  Server,
  Site,
  ManagedResource,
} from '../types';
import { KIND_OPTIONS } from '../constants';

interface CreateServiceFormProps {
  form: ServiceForm;
  onChange: (patch: Partial<ServiceForm>) => void;
  applications: ApplicationItem[];
  environments: ProjectEnvironment[];
  servers: Server[];
  sites: Site[];
  resources: ManagedResource[];
  saving: boolean;
  onCreate: () => void;
}

export function CreateServiceForm(props: CreateServiceFormProps) {
  const {
    form,
    onChange,
    applications,
    environments,
    servers,
    sites,
    resources,
    saving,
    onCreate,
  } = props;
  const t = useTranslations('applications');
  const handleCreate = usePersistFn(() => onCreate());

  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold">{t('addService')}</h2>
      <div className="mt-4 space-y-3">
        <select
          value={form.applicationId}
          onChange={(e) =>
            onChange({
              applicationId: e.target.value,
              environmentId: '',
              siteId: '',
              managedResourceId: '',
            })
          }
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('selectApp')}</option>
          {applications.map((a) => (
            <option
              key={a.id}
              value={a.id}
            >
              {a.project?.name ? `${a.project.name} / ` : ''}
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={form.environmentId}
          onChange={(e) => onChange({ environmentId: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('selectEnv')}</option>
          {environments.map((e) => (
            <option
              key={e.id}
              value={e.id}
            >
              {e.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('serviceNamePlaceholder')}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.kind}
            onChange={(e) => onChange({ kind: e.target.value })}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {KIND_OPTIONS.map((o) => (
              <option
                key={o.value}
                value={o.value}
              >
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <input
          value={form.runtime}
          onChange={(e) => onChange({ runtime: e.target.value })}
          placeholder={t('runtimePlaceholder')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select
          value={form.serverId}
          onChange={(e) => onChange({ serverId: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('noBindServer')}</option>
          {servers.map((s) => (
            <option
              key={s.id}
              value={s.id}
            >
              {s.name} ({s.host})
            </option>
          ))}
        </select>
        <select
          value={form.siteId}
          onChange={(e) => onChange({ siteId: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('noBindSite')}</option>
          {sites.map((s) => (
            <option
              key={s.id}
              value={s.id}
            >
              {s.name} ({s.primaryDomain})
            </option>
          ))}
        </select>
        <select
          value={form.managedResourceId}
          onChange={(e) => onChange({ managedResourceId: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('noBindResource')}</option>
          {resources.map((r) => (
            <option
              key={r.id}
              value={r.id}
            >
              {r.name} ({r.provider}/{r.kind})
            </option>
          ))}
        </select>
        <input
          value={form.workingDirectory}
          onChange={(e) => onChange({ workingDirectory: e.target.value })}
          placeholder={t('workingDirPlaceholder')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.buildCommand}
          onChange={(e) => onChange({ buildCommand: e.target.value })}
          placeholder={t('buildCommandPlaceholder')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.deployCommand}
          onChange={(e) => onChange({ deployCommand: e.target.value })}
          placeholder={t('deployCommandPlaceholder')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.healthCheckUrl}
          onChange={(e) => onChange({ healthCheckUrl: e.target.value })}
          placeholder={t('healthCheckUrlPlaceholder')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t('addService')}
        </button>
      </div>
    </section>
  );
}
