'use client';

import { useTranslations } from 'next-intl';
import type { PolicyForm, ProjectEnvironmentRef, ProjectRef } from '../types';

interface PolicyFormFieldsProps {
  form: PolicyForm;
  projects: ProjectRef[];
  environmentOptions: ProjectEnvironmentRef[];
  onChange: (patch: Partial<PolicyForm>) => void;
  onSelectProject: (projectId: string) => void;
}

export function PolicyFormFields({
  form,
  projects,
  environmentOptions,
  onChange,
  onSelectProject,
}: PolicyFormFieldsProps) {
  const t = useTranslations('accessPolicies');
  const tc = useTranslations('common');
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label={tc('name')}>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder={t('namePlaceholder')}
        />
      </Field>
      <Field label={tc('description')}>
        <input
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder={t('descriptionPlaceholder')}
        />
      </Field>
      <Field label={t('effect')}>
        <select
          value={form.effect}
          onChange={(e) => onChange({ effect: e.target.value as PolicyForm['effect'] })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="allow">{t('allow')}</option>
          <option value="deny">{t('deny')}</option>
        </select>
      </Field>
      <Field label={t('priority')}>
        <input
          value={form.priority}
          onChange={(e) => onChange({ priority: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          inputMode="numeric"
        />
      </Field>
      <Field label={t('principalType')}>
        <select
          value={form.principalType}
          onChange={(e) =>
            onChange({ principalType: e.target.value as PolicyForm['principalType'] })
          }
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="team_role">{t('principalTeamRole')}</option>
          <option value="user">{t('principalUser')}</option>
          <option value="any">{t('principalAny')}</option>
        </select>
      </Field>
      {form.principalType === 'team_role' ? (
        <Field label={t('teamRole')}>
          <select
            value={form.principalRole}
            onChange={(e) => onChange({ principalRole: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="owner">{t('roleOwner')}</option>
            <option value="admin">{t('roleAdmin')}</option>
            <option value="member">{t('roleMember')}</option>
          </select>
        </Field>
      ) : (
        <Field label={t('userId')}>
          <input
            value={form.principalUserId}
            onChange={(e) => onChange({ principalUserId: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder={form.principalType === 'user' ? t('userIdPlaceholder') : t('anyMemberHint')}
            disabled={form.principalType !== 'user'}
          />
        </Field>
      )}
      <Field label={t('project')}>
        <select
          value={form.projectId}
          onChange={(e) => onSelectProject(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('allProjects')}</option>
          {projects.map((project) => (
            <option
              key={project.id}
              value={project.id}
            >
              {project.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('environment')}>
        <select
          value={form.environmentId}
          onChange={(e) => onChange({ environmentId: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('allEnvironments')}</option>
          {environmentOptions.map((env) => (
            <option
              key={env.id}
              value={env.id}
            >
              {env.project?.name ? `${env.project.name} / ` : ''}
              {env.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('categories')}>
        <input
          value={form.categories}
          onChange={(e) => onChange({ categories: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="deployment, site, resource_action"
        />
      </Field>
      <Field label="Action">
        <input
          value={form.actions}
          onChange={(e) => onChange({ actions: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="deployment.run, site.*, *"
        />
      </Field>
      <Field label={t('riskLevels')}>
        <input
          value={form.riskLevels}
          onChange={(e) => onChange({ riskLevels: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="medium, high"
        />
      </Field>
      <label className="flex items-center gap-2 pt-7 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
        />
        {t('enablePolicy')}
      </label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
