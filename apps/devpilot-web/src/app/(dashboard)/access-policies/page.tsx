'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

interface AccessPolicy {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  effect: 'allow' | 'deny';
  principalType: 'team_role' | 'user' | 'any';
  principalRole?: string | null;
  principalUserId?: string | null;
  categories?: unknown;
  actions?: unknown;
  riskLevels?: unknown;
  priority: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name?: string | null; email: string } | null;
  principalUser?: { id: string; name?: string | null; email: string } | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
}

interface Project {
  id: string;
  name: string;
}

interface ProjectEnvironment {
  id: string;
  key: string;
  name: string;
  status: string;
  project?: { id: string; name: string } | null;
}

type PolicyForm = {
  name: string;
  description: string;
  enabled: boolean;
  effect: 'allow' | 'deny';
  principalType: 'team_role' | 'user' | 'any';
  principalRole: string;
  principalUserId: string;
  projectId: string;
  environmentId: string;
  categories: string;
  actions: string;
  riskLevels: string;
  priority: string;
};

const emptyForm: PolicyForm = {
  name: '',
  description: '',
  enabled: true,
  effect: 'allow',
  principalType: 'team_role',
  principalRole: 'admin',
  principalUserId: '',
  projectId: '',
  environmentId: '',
  categories: '',
  actions: '',
  riskLevels: '',
  priority: '0',
};

export default function AccessPoliciesPage() {
  const [policies, setPolicies] = useState<AccessPolicy[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [form, setForm] = useState<PolicyForm>(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setError('');
    try {
      const [policyData, projectData, environmentData] = await Promise.all([
        api.get<AccessPolicy[]>('/control-access-policies'),
        api.get<Project[]>('/projects'),
        api.get<ProjectEnvironment[]>('/project-environments', { params: { status: 'active' } }),
      ]);
      setPolicies(policyData);
      setProjects(projectData);
      setEnvironments(environmentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载访问策略失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => ({
    total: policies.length,
    enabled: policies.filter((policy) => policy.enabled).length,
    denies: policies.filter((policy) => policy.effect === 'deny').length,
    scoped: policies.filter((policy) => policy.project || policy.environment).length,
    userScoped: policies.filter((policy) => policy.principalType === 'user').length,
  }), [policies]);

  const environmentOptions = useMemo(() => (
    environments.filter((environment) => !form.projectId || environment.project?.id === form.projectId)
  ), [environments, form.projectId]);

  const savePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      enabled: form.enabled,
      effect: form.effect,
      principalType: form.principalType,
      principalRole: form.principalType === 'team_role' ? form.principalRole : undefined,
      principalUserId: form.principalType === 'user' ? form.principalUserId.trim() : undefined,
      projectId: form.projectId || undefined,
      environmentId: form.environmentId || undefined,
      categories: parseCsv(form.categories),
      actions: parseCsv(form.actions),
      riskLevels: parseCsv(form.riskLevels),
      priority: Number.parseInt(form.priority || '0', 10) || 0,
    };

    try {
      if (!payload.name) {
        throw new Error('请填写策略名称');
      }
      if (payload.principalType === 'user' && !payload.principalUserId) {
        throw new Error('用户级策略需要填写用户 ID');
      }

      if (editingId) {
        await api.patch(`/control-access-policies/${editingId}`, {
          ...payload,
          principalRole: form.principalType === 'team_role' ? form.principalRole : null,
          principalUserId: form.principalType === 'user' ? form.principalUserId.trim() : null,
          projectId: form.projectId || null,
          environmentId: form.environmentId || null,
        });
      } else {
        await api.post('/control-access-policies', payload);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存访问策略失败');
    } finally {
      setSaving(false);
    }
  };

  const editPolicy = (policy: AccessPolicy) => {
    setEditingId(policy.id);
    setForm({
      name: policy.name,
      description: policy.description || '',
      enabled: policy.enabled,
      effect: policy.effect,
      principalType: policy.principalType,
      principalRole: policy.principalRole || 'admin',
      principalUserId: policy.principalUserId || '',
      projectId: policy.project?.id || '',
      environmentId: policy.environment?.id || '',
      categories: readStringArray(policy.categories).join(', '),
      actions: readStringArray(policy.actions).join(', '),
      riskLevels: readStringArray(policy.riskLevels).join(', '),
      priority: String(policy.priority ?? 0),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId('');
    setForm(emptyForm);
  };

  const togglePolicy = async (policy: AccessPolicy) => {
    setActingId(`${policy.id}:toggle`);
    setError('');
    try {
      await api.patch(`/control-access-policies/${policy.id}`, { enabled: !policy.enabled });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新访问策略状态失败');
    } finally {
      setActingId('');
    }
  };

  const deletePolicy = async (policy: AccessPolicy) => {
    if (!window.confirm(`删除访问策略「${policy.name}」？`)) return;

    setActingId(`${policy.id}:delete`);
    setError('');
    try {
      await api.delete(`/control-access-policies/${policy.id}`);
      if (editingId === policy.id) resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除访问策略失败');
    } finally {
      setActingId('');
    }
  };

  const selectProject = (projectId: string) => {
    const environmentStillMatches = environments.some((environment) => (
      environment.id === form.environmentId &&
      (!projectId || environment.project?.id === projectId)
    ));
    setForm((current) => ({
      ...current,
      projectId,
      environmentId: environmentStillMatches ? current.environmentId : '',
    }));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">访问策略</h1>
          <p className="mt-1 text-muted-foreground">
            管理控制面在项目、环境、操作分类和风险等级上的 allow/deny 策略
          </p>
        </div>
        <button
          onClick={loadData}
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Metric label="策略数" value={stats.total} />
        <Metric label="已启用" value={stats.enabled} />
        <Metric label="拒绝策略" value={stats.denies} />
        <Metric label="限定作用域" value={stats.scoped} />
        <Metric label="用户级" value={stats.userScoped} />
      </div>

      <form onSubmit={savePolicy} className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {editingId ? '编辑访问策略' : '新建访问策略'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Deny 优先于 allow；未命中策略时沿用团队角色默认行为
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              取消编辑
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">名称</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="prod 部署拒绝策略"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">说明</span>
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="限制某类主体操作生产环境"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">效果</span>
            <select
              value={form.effect}
              onChange={(event) => setForm({ ...form, effect: event.target.value as PolicyForm['effect'] })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="allow">允许</option>
              <option value="deny">拒绝</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">优先级</span>
            <input
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              inputMode="numeric"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">主体类型</span>
            <select
              value={form.principalType}
              onChange={(event) => setForm({ ...form, principalType: event.target.value as PolicyForm['principalType'] })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="team_role">团队角色</option>
              <option value="user">指定用户</option>
              <option value="any">任意成员</option>
            </select>
          </label>
          {form.principalType === 'team_role' ? (
            <label className="space-y-1">
              <span className="text-sm font-medium">团队角色</span>
              <select
                value={form.principalRole}
                onChange={(event) => setForm({ ...form, principalRole: event.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="owner">所有者</option>
                <option value="admin">管理员</option>
                <option value="member">成员</option>
              </select>
            </label>
          ) : (
            <label className="space-y-1">
              <span className="text-sm font-medium">用户 ID</span>
              <input
                value={form.principalUserId}
                onChange={(event) => setForm({ ...form, principalUserId: event.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder={form.principalType === 'user' ? '团队成员 userId' : '任意成员无需填写'}
                disabled={form.principalType !== 'user'}
              />
            </label>
          )}
          <label className="space-y-1">
            <span className="text-sm font-medium">项目</span>
            <select
              value={form.projectId}
              onChange={(event) => selectProject(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">全部项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">环境</span>
            <select
              value={form.environmentId}
              onChange={(event) => setForm({ ...form, environmentId: event.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">全部环境</option>
              {environmentOptions.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.project?.name ? `${environment.project.name} / ` : ''}{environment.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">操作分类</span>
            <input
              value={form.categories}
              onChange={(event) => setForm({ ...form, categories: event.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="deployment, site, resource_action"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Action</span>
            <input
              value={form.actions}
              onChange={(event) => setForm({ ...form, actions: event.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="deployment.run, site.*, *"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">风险等级</span>
            <input
              value={form.riskLevels}
              onChange={(event) => setForm({ ...form, riskLevels: event.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="medium, high"
            />
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
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

      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">策略列表</h2>
        </div>
        <div className="divide-y">
          {policies.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground">暂无访问策略</div>
          ) : policies.map((policy) => (
            <div key={policy.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{policy.name}</h3>
                    <Badge tone={policy.enabled ? 'green' : 'gray'}>
                      {policy.enabled ? '启用' : '停用'}
                    </Badge>
                    <Badge tone={policy.effect === 'deny' ? 'red' : 'blue'}>
                      {policy.effect === 'deny' ? '拒绝' : '允许'}
                    </Badge>
                  </div>
                  {policy.description && (
                    <p className="text-sm text-muted-foreground">{policy.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{formatPrincipal(policy)}</span>
                    <span>{formatScope(policy)}</span>
                    <span>分类 {formatList(policy.categories)}</span>
                    <span>Action {formatList(policy.actions)}</span>
                    <span>Risk {formatList(policy.riskLevels)}</span>
                    <span>优先级 {policy.priority}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => editPolicy(policy)}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => togglePolicy(policy)}
                    disabled={actingId === `${policy.id}:toggle`}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    {policy.enabled ? '停用' : '启用'}
                  </button>
                  <button
                    onClick={() => deletePolicy(policy)}
                    disabled={actingId === `${policy.id}:delete`}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: string; tone: 'green' | 'red' | 'blue' | 'gray' }) {
  const className = {
    green: 'border-green-200 bg-green-50 text-green-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
  }[tone];

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${className}`}>
      {children}
    </span>
  );
}

function parseCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function formatList(value: unknown) {
  const list = readStringArray(value);
  return list.length ? list.join(', ') : '全部';
}

function formatPrincipal(policy: AccessPolicy) {
  if (policy.principalType === 'any') return '主体 任意成员';
  if (policy.principalType === 'user') {
    return `主体 ${policy.principalUser?.email || policy.principalUserId || '指定用户'}`;
  }
  return `主体 ${formatRole(policy.principalRole)}`;
}

function formatRole(role?: string | null) {
  if (role === 'owner') return '所有者';
  if (role === 'admin') return '管理员';
  if (role === 'member') return '成员';
  return '团队角色';
}

function formatScope(policy: AccessPolicy) {
  const project = policy.project?.name || '全部项目';
  const environment = policy.environment?.name || '全部环境';
  return `范围 ${project} / ${environment}`;
}
