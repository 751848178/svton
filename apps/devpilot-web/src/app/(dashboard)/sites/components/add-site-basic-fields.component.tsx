/** Basic AddSiteModal fields before runtime/TLS configuration. */
'use client';

import { useTranslations } from 'next-intl';
import type { Project, ProjectEnvironment, Server, SiteRuntimeType } from '../types';
import type { AddSiteFormData } from './add-site-form.types';

interface AddSiteBasicFieldsProps {
  formData: AddSiteFormData;
  servers: Server[];
  projects: Project[];
  projectEnvironments: ProjectEnvironment[];
  onChange: (patch: Partial<AddSiteFormData>) => void;
}

export function AddSiteBasicFields({
  formData,
  servers,
  projects,
  projectEnvironments,
  onChange,
}: AddSiteBasicFieldsProps) {
  const t = useTranslations('sites');
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">{t('siteName')}</label>
          <input
            value={formData.name}
            onChange={(event) => onChange({ name: event.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder={t('siteNamePlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('primaryDomain')}</label>
          <input
            value={formData.primaryDomain}
            onChange={(event) => onChange({ primaryDomain: event.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="app.example.com"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t('domainAliases')}</label>
        <input
          value={formData.aliases}
          onChange={(event) => onChange({ aliases: event.target.value })}
          className="w-full rounded-md border px-3 py-2"
          placeholder="www.example.com, api.example.com"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">{t('runtimeType')}</label>
          <select
            value={formData.runtimeType}
            onChange={(event) => onChange({ runtimeType: event.target.value as SiteRuntimeType })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="reverse_proxy">{t('rtReverseProxy')}</option>
            <option value="static">{t('rtStatic')}</option>
            <option value="docker">{t('rtDocker')}</option>
            <option value="runtime">{t('rtRuntime')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('targetServer')}</label>
          <select
            value={formData.serverId}
            onChange={(event) => onChange({ serverId: event.target.value })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">{t('noServer')}</option>
            {servers.map((server) => (
              <option
                key={server.id}
                value={server.id}
              >
                {server.name} ({server.host})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('linkedProject')}</label>
          <select
            value={formData.projectId}
            onChange={(event) => onChange({ projectId: event.target.value, environmentId: '' })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">{t('noProject')}</option>
            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t('projectEnvironment')}</label>
        <select
          value={formData.environmentId}
          onChange={(event) => onChange({ environmentId: event.target.value })}
          className="w-full rounded-md border px-3 py-2"
          disabled={!formData.projectId}
        >
          <option value="">{t('noEnvironment')}</option>
          {projectEnvironments
            .filter(
              (environment) =>
                environment.projectId === formData.projectId && environment.status !== 'archived',
            )
            .map((environment) => (
              <option
                key={environment.id}
                value={environment.id}
              >
                {environment.name} ({environment.key})
              </option>
            ))}
        </select>
      </div>
    </>
  );
}
