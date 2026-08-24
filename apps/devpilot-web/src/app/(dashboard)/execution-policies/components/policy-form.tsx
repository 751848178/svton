/**
 * 策略模板表单
 *
 * 单一职责：收集策略模板字段并提交保存。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Checkbox, Input, Select, Textarea } from '@/components/ui';
import type { FormEvent } from 'react';
import type { PolicyForm, Project, ProjectEnvironment } from '../types';

interface PolicyFormProps {
  form: PolicyForm;
  onChange: (patch: Partial<PolicyForm>) => void;
  editingId: string;
  saving: boolean;
  projects: Project[];
  environmentOptions: ProjectEnvironment[];
  environments: ProjectEnvironment[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  onSelectProject: (projectId: string) => void;
}

export function PolicyFormView(props: PolicyFormProps) {
  const { form, onChange, editingId, saving, projects, environmentOptions, environments } = props;
  const { onSubmit, onReset, onSelectProject } = props;
  const t = useTranslations('executionPolicies');
  const tc = useTranslations('common');

  const handleEnvChange = usePersistFn((value: string) => {
    const env = environments.find((e) => e.id === value);
    onChange({ environmentId: value, projectId: env?.project?.id || form.projectId });
  });

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {editingId ? t('editTemplate') : t('newTemplate')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('formHint')}</p>
        </div>
        <div className="flex gap-2">
          {editingId ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              {t('cancelEdit')}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? t('saving') : t('savePolicy')}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Field label={tc('name')}>
          <Input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('namePlaceholder')}
          />
        </Field>
        <Field label={t('priority')}>
          <Input
            type="number"
            min="0"
            value={form.priority}
            onChange={(e) => onChange({ priority: e.target.value })}
          />
        </Field>
        <Field label={t('project')}>
          <Select
            value={form.projectId}
            onChange={(e) => onSelectProject(e.target.value)}
          >
            <option value="">{t('teamGlobal')}</option>
            {projects.map((p) => (
              <option
                key={p.id}
                value={p.id}
              >
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('environment')}>
          <Select
            value={form.environmentId}
            onChange={(e) => handleEnvChange(e.target.value)}
          >
            <option value="">{t('anyEnvironment')}</option>
            {environmentOptions.map((e) => (
              <option
                key={e.id}
                value={e.id}
              >
                {e.project?.name ? `${e.project.name} / ` : ''}
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('adapterKeys')}>
          <Input
            value={form.adapterKeys}
            onChange={(e) => onChange({ adapterKeys: e.target.value })}
            placeholder={t('adapterKeysPlaceholder')}
          />
        </Field>
        <Field label={t('operationKeys')}>
          <Input
            value={form.operationKeys}
            onChange={(e) => onChange({ operationKeys: e.target.value })}
            placeholder={t('operationKeysPlaceholder')}
          />
        </Field>
        <Field
          label={t('descriptionLabel')}
          className="lg:col-span-2"
        >
          <Input
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t('descriptionPlaceholder')}
          />
        </Field>
        <Field label={t('allowPatterns')}>
          <Textarea
            value={form.allowedPatterns}
            onChange={(e) => onChange({ allowedPatterns: e.target.value })}
            className="min-h-32 font-mono"
            placeholder={t('allowPatternsPlaceholder')}
          />
        </Field>
        <Field label={t('blockPatterns')}>
          <Textarea
            value={form.blockedPatterns}
            onChange={(e) => onChange({ blockedPatterns: e.target.value })}
            className="min-h-32 font-mono"
            placeholder={t('blockPatternsPlaceholder')}
          />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
        />
        {t('enableTemplate')}
      </label>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-2 ${className ?? ''}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
