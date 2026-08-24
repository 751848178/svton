/** Basic AddSiteModal fields before runtime/TLS configuration. */
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type { Project, ProjectEnvironment, Server, SiteRuntimeType } from '../types';
import type { AddSiteFormData } from './add-site-form.types';

/** 字段级内联校验文案（DOM-1/DOM-2）；undefined 表示该字段当前无问题。 */
export interface AddSiteFieldErrors {
  name?: string;
  primaryDomain?: string;
  aliases?: string;
}

interface AddSiteBasicFieldsProps {
  formData: AddSiteFormData;
  servers: Server[];
  projects: Project[];
  projectEnvironments: ProjectEnvironment[];
  lockedContext?: { projectName: string; environmentName: string };
  onChange: (patch: Partial<AddSiteFormData>) => void;
  errors?: AddSiteFieldErrors;
}

export function AddSiteBasicFields({
  formData,
  servers,
  projects,
  projectEnvironments,
  lockedContext,
  onChange,
  errors,
}: AddSiteBasicFieldsProps) {
  const t = useTranslations('sites');
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="site-name-input">
            {t('siteName')}
            <span className="text-destructive">*</span>
          </label>
          <Input
            id="site-name-input"
            value={formData.name}
            onChange={(event) => onChange({ name: event.target.value })}
            required
            invalid={Boolean(errors?.name)}
            placeholder={t('siteNamePlaceholder')}
          />
          <FieldError message={errors?.name} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="site-primary-domain-input">
            {t('primaryDomain')}
            <span className="text-destructive">*</span>
          </label>
          <Input
            id="site-primary-domain-input"
            value={formData.primaryDomain}
            onChange={(event) => onChange({ primaryDomain: event.target.value })}
            required
            invalid={Boolean(errors?.primaryDomain)}
            placeholder="app.example.com"
          />
          <FieldError message={errors?.primaryDomain} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="site-aliases-input">
          {t('domainAliases')}
        </label>
        <Input
          id="site-aliases-input"
          value={formData.aliases}
          onChange={(event) => onChange({ aliases: event.target.value })}
          invalid={Boolean(errors?.aliases)}
          placeholder="www.example.com, api.example.com"
        />
        <FieldError message={errors?.aliases} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">{t('runtimeType')}</label>
          <Select
            value={formData.runtimeType}
            onChange={(event) => onChange({ runtimeType: event.target.value as SiteRuntimeType })}
          >
            <option value="reverse_proxy">{t('rtReverseProxy')}</option>
            <option value="static">{t('rtStatic')}</option>
            <option value="docker">{t('rtDocker')}</option>
            <option value="runtime">{t('rtRuntime')}</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('targetServer')}</label>
          <Select
            value={formData.serverId}
            onChange={(event) => onChange({ serverId: event.target.value })}
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
          </Select>
        </div>
        {lockedContext ? (
          <div>
            <span className="mb-1 block text-sm font-medium">{t('linkedProject')}</span>
            <p className="min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {lockedContext.projectName}
            </p>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium">{t('linkedProject')}</label>
            <Select
              value={formData.projectId}
              onChange={(event) => onChange({ projectId: event.target.value, environmentId: '' })}
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
            </Select>
          </div>
        )}
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium">{t('projectEnvironment')}</span>
        {lockedContext ? (
          <p className="min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {lockedContext.environmentName}
          </p>
        ) : (
          <Select
            value={formData.environmentId}
            onChange={(event) => onChange({ environmentId: event.target.value })}
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
          </Select>
        )}
      </div>
    </>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}
