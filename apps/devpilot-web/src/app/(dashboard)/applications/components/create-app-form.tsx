/**
 * 创建应用表单
 *
 * 单一职责：收集应用基本信息并提交。
 */

import { usePersistFn } from '@svton/hooks';
import type { AppForm, Project } from '../types';

interface CreateAppFormProps {
  form: AppForm;
  onChange: (patch: Partial<AppForm>) => void;
  projects: Project[];
  saving: boolean;
  onCreate: () => void;
}

export function CreateAppForm({ form, onChange, projects, saving, onCreate }: CreateAppFormProps) {
  const handleCreate = usePersistFn(() => onCreate());
  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold">创建应用</h2>
      <div className="mt-4 space-y-3">
        <select
          value={form.projectId}
          onChange={(e) => onChange({ projectId: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">选择项目</option>
          {projects.map((p) => (
            <option
              key={p.id}
              value={p.id}
            >
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="应用名称，例如 devpilot"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.repositoryUrl}
          onChange={(e) => onChange({ repositoryUrl: e.target.value })}
          placeholder="Git 仓库 URL"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={form.defaultBranch}
            onChange={(e) => onChange({ defaultBranch: e.target.value })}
            placeholder="默认分支"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.repoPath}
            onChange={(e) => onChange({ repoPath: e.target.value })}
            placeholder="仓库内路径"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          创建应用
        </button>
      </div>
    </section>
  );
}
