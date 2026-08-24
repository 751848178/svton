'use client';

import { useTranslations } from 'next-intl';
import { Checkbox, Input, Select } from '@/components/ui';
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
        <Input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
                    />
      </Field>
      <Field label={tc('description')}>
        <Input
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
                    />
      </Field>
      <Field label={t('effect')}>
        <Select
          value={form.effect}
          onChange={(e) => onChange({ effect: e.target.value as PolicyForm['effect'] })}
                  >
          <option value="allow">{t('allow')}</option>
          <option value="deny">{t('deny')}</option>
        </Select>
      </Field>
      <Field label={t('priority')}>
        <Input
          value={form.priority}
          onChange={(e) => onChange({ priority: e.target.value })}
          inputMode="numeric"
        />
      </Field>
      <Field label={t('principalType')}>
        <Select
          value={form.principalType}
          onChange={(e) =>
            onChange({ principalType: e.target.value as PolicyForm['principalType'] })
          }
                  >
          <option value="team_role">{t('principalTeamRole')}</option>
          <option value="user">{t('principalUser')}</option>
          <option value="any">{t('principalAny')}</option>
        </Select>
      </Field>
      {form.principalType === 'team_role' ? (
        <Field label={t('teamRole')}>
          <Select
            value={form.principalRole}
            onChange={(e) => onChange({ principalRole: e.target.value })}
                      >
            <option value="owner">{t('roleOwner')}</option>
            <option value="admin">{t('roleAdmin')}</option>
            <option value="member">{t('roleMember')}</option>
          </Select>
        </Field>
      ) : (
        <Field label={t('userId')}>
          <Input
            value={form.principalUserId}
            onChange={(e) => onChange({ principalUserId: e.target.value })}
                        />
        </Field>
      )}
      <Field label={t('project')}>
        <Select
          value={form.projectId}
          onChange={(e) => onSelectProject(e.target.value)}
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
        </Select>
      </Field>
      <Field label={t('environment')}>
        <Select
          value={form.environmentId}
          onChange={(e) => onChange({ environmentId: e.target.value })}
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
        </Select>
      </Field>
      <Field label={t('categories')}>
        <Input
          value={form.categories}
          onChange={(e) => onChange({ categories: e.target.value })}
                    />
      </Field>
      <Field label={t('action')}>
        <Input
          value={form.actions}
          onChange={(e) => onChange({ actions: e.target.value })}
                    />
      </Field>
      <Field label={t('riskLevels')}>
        <Input
          value={form.riskLevels}
          onChange={(e) => onChange({ riskLevels: e.target.value })}
                    />
      </Field>
      <div className="pt-7">
        <Checkbox
          checked={form.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          label={t('enablePolicy')}
        />
      </div>
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
