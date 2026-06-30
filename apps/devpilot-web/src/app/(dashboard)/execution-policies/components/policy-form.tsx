/**
 * 策略模板表单
 *
 * 单一职责：收集策略模板字段并提交保存。
 */

import { usePersistFn } from '@svton/hooks';
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
          <h2 className="text-lg font-semibold">{editingId ? '编辑策略模板' : '新建策略模板'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            模板会在危险命令基线之后参与 Server executor 命令判定
          </p>
        </div>
        <div className="flex gap-2">
          {editingId ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              取消编辑
            </button>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? '保存中...' : '保存策略'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Field label="名称">
          <input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="生产环境 Docker 只读巡检"
          />
        </Field>
        <Field label="优先级">
          <input
            type="number"
            min="0"
            value={form.priority}
            onChange={(e) => onChange({ priority: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="项目">
          <select
            value={form.projectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">团队全局</option>
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
            onChange={(e) => handleEnvChange(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">不限环境</option>
            {environmentOptions.map((e) => (
              <option
                key={e.id}
                value={e.id}
              >
                {e.project?.name ? `${e.project.name} / ` : ''}
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Adapter keys">
          <input
            value={form.adapterKeys}
            onChange={(e) => onChange({ adapterKeys: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="deployment-script-plan, nginx-site-plan"
          />
        </Field>
        <Field label="Operation keys">
          <input
            value={form.operationKeys}
            onChange={(e) => onChange({ operationKeys: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="deploy, sync-site"
          />
        </Field>
        <Field
          label="说明"
          className="lg:col-span-2"
        >
          <input
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="限定生产环境只允许健康检查和受控重载"
          />
        </Field>
        <Field label="Allow patterns">
          <textarea
            value={form.allowedPatterns}
            onChange={(e) => onChange({ allowedPatterns: e.target.value })}
            className="min-h-32 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
            placeholder="^docker ps .*"
          />
        </Field>
        <Field label="Block patterns">
          <textarea
            value={form.blockedPatterns}
            onChange={(e) => onChange({ blockedPatterns: e.target.value })}
            className="min-h-32 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
            placeholder="^docker exec .* sh"
          />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
        />
        启用策略模板
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
