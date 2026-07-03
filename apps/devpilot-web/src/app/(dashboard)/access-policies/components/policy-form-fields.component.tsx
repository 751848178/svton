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
  return (
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
