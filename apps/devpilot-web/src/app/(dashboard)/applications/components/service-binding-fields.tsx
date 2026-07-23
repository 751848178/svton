/**
 * 添加服务表单 — 绑定分区
 *
 * 单一职责：渲染 app/env/name/kind/runtime/server/site/resource 绑定字段。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type {
  ServiceForm,
  ApplicationItem,
  ProjectEnvironment,
  Server,
  Site,
  ManagedResource,
} from '../types';
import { KIND_VALUES } from '../constants';

interface ServiceBindingFieldsProps {
  form: ServiceForm;
  onChange: (patch: Partial<ServiceForm>) => void;
  applications: ApplicationItem[];
  environments: ProjectEnvironment[];
  servers: Server[];
  sites: Site[];
  resources: ManagedResource[];
}

export function ServiceBindingFields(props: ServiceBindingFieldsProps) {
  const { form, onChange, applications, environments, servers, sites, resources } = props;
  const t = useTranslations('applications');

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase text-muted-foreground">{t('sectionBinding')}</h3>
      <Select
        value={form.applicationId}
        onChange={(e) =>
          onChange({
            applicationId: e.target.value,
            environmentId: '',
            siteId: '',
            managedResourceId: '',
          })
        }
        placeholder={t('selectApp')}
      >
        {applications.map((a) => (
          <option
            key={a.id}
            value={a.id}
          >
            {a.project?.name ? `${a.project.name} / ` : ''}
            {a.name}
          </option>
        ))}
      </Select>
      <Select
        value={form.environmentId}
        onChange={(e) => onChange({ environmentId: e.target.value })}
        placeholder={t('selectEnv')}
      >
        {environments.map((e) => (
          <option
            key={e.id}
            value={e.id}
          >
            {e.name}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('serviceNamePlaceholder')}
        />
        <Select
          value={form.kind}
          onChange={(e) => onChange({ kind: e.target.value })}
        >
          {KIND_VALUES.map((o) => (
            <option
              key={o.value}
              value={o.value}
            >
              {t(o.labelKey)}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={form.runtime}
          onChange={(e) => onChange({ runtime: e.target.value })}
          placeholder={t('runtimePlaceholder')}
        />
        <Select
          value={form.serverId}
          onChange={(e) => onChange({ serverId: e.target.value })}
          placeholder={t('noBindServer')}
        >
          {servers.map((s) => (
            <option
              key={s.id}
              value={s.id}
            >
              {s.name} ({s.host})
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={form.siteId}
          onChange={(e) => onChange({ siteId: e.target.value })}
          placeholder={t('noBindSite')}
        >
          {sites.map((s) => (
            <option
              key={s.id}
              value={s.id}
            >
              {s.name} ({s.primaryDomain})
            </option>
          ))}
        </Select>
        <Select
          value={form.managedResourceId}
          onChange={(e) => onChange({ managedResourceId: e.target.value })}
          placeholder={t('noBindResource')}
        >
          {resources.map((r) => (
            <option
              key={r.id}
              value={r.id}
            >
              {r.name} ({r.provider}/{r.kind})
            </option>
          ))}
        </Select>
      </div>
    </section>
  );
}
