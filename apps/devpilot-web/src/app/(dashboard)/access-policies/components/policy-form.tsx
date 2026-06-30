/**
 * 访问策略表单
 *
 * 单一职责：收集策略字段并提交保存。
 */

import { usePersistFn } from '@svton/hooks';
import type { FormEvent } from 'react';
import type { PolicyForm, ProjectRef, ProjectEnvironmentRef } from '../types';

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

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="名称">
          <input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="prod 部署拒绝策略"
          />
        </Field>
        <Field label="说明">
          <input
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="限制某类主体操作生产环境"
          />
        </Field>
        <Field label="效果">
          <select
            value={form.effect}
            onChange={(e) => onChange({ effect: e.target.value as PolicyForm['effect'] })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="allow">允许</option>
            <option value="deny">拒绝</option>
          </select>
        </Field>
        <Field label="优先级">
          <input
            value={form.priority}
            onChange={(e) => onChange({ priority: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            inputMode="numeric"
          />
        </Field>
        <Field label="主体类型">
          <select
            value={form.principalType}
            onChange={(e) =>
              onChange({ principalType: e.target.value as PolicyForm['principalType'] })
            }
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="team_role">团队角色</option>
            <option value="user">指定用户</option>
            <option value="any">任意成员</option>
          </select>
        </Field>
        {form.principalType === 'team_role' ? (
          <Field label="团队角色">
            <select
              value={form.principalRole}
              onChange={(e) => onChange({ principalRole: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="owner">所有者</option>
              <option value="admin">管理员</option>
              <option value="member">成员</option>
            </select>
          </Field>
        ) : (
          <Field label="用户 ID">
            <input
              value={form.principalUserId}
              onChange={(e) => onChange({ principalUserId: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder={form.principalType === 'user' ? '团队成员 userId' : '任意成员无需填写'}
              disabled={form.principalType !== 'user'}
            />
          </Field>
        )}
        <Field label="项目">
          <select
            value={form.projectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option
                key={p.id}
                value={p.id}
              >
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="环境">
          <select
            value={form.environmentId}
            onChange={(e) => onChange({ environmentId: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">全部环境</option>
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
        <Field label="操作分类">
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
        <Field label="风险等级">
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
          启用策略
        </label>
      </div>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
