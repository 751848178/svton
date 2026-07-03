/**
 * 访问策略表单
 *
 * 单一职责：收集策略字段并提交保存。
 */

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

  const handleSubmit = usePersistFn((event: FormEvent<HTMLFormElement>) => onSubmit(event));

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{editingId ? '编辑访问策略' : '新建访问策略'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deny 优先于 allow；未命中策略时沿用团队角色默认行为
          </p>
        </div>
        {editingId ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            取消编辑
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
          {saving ? '保存中...' : editingId ? '保存修改' : '创建策略'}
        </button>
      </div>
    </form>
  );
}
