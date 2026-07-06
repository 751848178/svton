/**
 * 访问策略表单
 *
 * 单一职责：收集策略字段并提交保存。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import type { FormEvent } from 'react';
import type { PolicyForm, ProjectRef, ProjectEnvironmentRef } from '../types';
import { PolicyFormFields } from './policy-form-fields.component';

interface PolicyFormProps {
  form: PolicyForm;
  onChange: (patch: Partial<PolicyForm>) => void;
  editingId: string;
  saving: boolean;
  projects: ProjectRef[];
  environmentOptions: ProjectEnvironmentRef[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  onSelectProject: (projectId: string) => void;
}

export function PolicyFormView(props: PolicyFormProps) {
  const {
    form,
    onChange,
    editingId,
    saving,
    projects,
    environmentOptions,
    onSubmit,
    onReset,
    onSelectProject,
  } = props;
  const t = useTranslations('accessPolicies');

  const handleSubmit = usePersistFn((event: FormEvent<HTMLFormElement>) => onSubmit(event));

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {editingId ? t('editPolicy') : t('newPolicy')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('formHint')}</p>
        </div>
        {editingId ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            {t('cancelEdit')}
          </button>
        ) : null}
      </div>

      <PolicyFormFields
        form={form}
        projects={projects}
        environmentOptions={environmentOptions}
        onChange={onChange}
        onSelectProject={onSelectProject}
      />

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? t('saving') : editingId ? t('saveChanges') : t('createPolicy')}
        </button>
      </div>
    </form>
  );
}
