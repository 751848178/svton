'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

interface PolicyTemplate {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  priority: number;
  adapterKeys?: unknown;
  operationKeys?: unknown;
  allowedPatterns?: unknown;
  blockedPatterns?: unknown;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name?: string | null; email: string } | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string } | null;
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
  projectId: string;
  environmentId: string;
  enabled: boolean;
  priority: string;
  adapterKeys: string;
  operationKeys: string;
  allowedPatterns: string;
  blockedPatterns: string;
};

const emptyForm: PolicyForm = {
  name: '',
  description: '',
  projectId: '',
  environmentId: '',
  enabled: true,
  priority: '0',
  adapterKeys: '',
  operationKeys: '',
  allowedPatterns: '',
  blockedPatterns: '',
};

export default function ExecutionPoliciesPage() {
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
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
      const [templateData, projectData, environmentData] = await Promise.all([
        api.get<PolicyTemplate[]>('/server-command-policy-templates'),
        api.get<Project[]>('/projects'),
        api.get<ProjectEnvironment[]>('/project-environments', { params: { status: 'active' } }),
      ]);
      setTemplates(templateData);
      setProjects(projectData);
      setEnvironments(environmentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载执行策略失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => ({
    total: templates.length,
    enabled: templates.filter((template) => template.enabled).length,
    scoped: templates.filter((template) => template.project || template.environment).length,
    blockingRules: templates.reduce((sum, template) => sum + readStringArray(template.blockedPatterns).length, 0),
    allowingRules: templates.reduce((sum, template) => sum + readStringArray(template.allowedPatterns).length, 0),
  }), [templates]);

  const environmentOptions = useMemo(() => (
    environments.filter((environment) => !form.projectId || environment.project?.id === form.projectId)
  ), [environments, form.projectId]);

  const saveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      projectId: form.projectId || undefined,
      environmentId: form.environmentId || undefined,
      enabled: form.enabled,
      priority: Number.parseInt(form.priority || '0', 10) || 0,
      adapterKeys: parseCsv(form.adapterKeys),
      operationKeys: parseCsv(form.operationKeys),
      allowedPatterns: parseLines(form.allowedPatterns),
      blockedPatterns: parseLines(form.blockedPatterns),
    };

    try {
      if (!payload.name) {
        throw new Error('请填写策略模板名称');
      }

      if (editingId) {
        await api.patch(`/server-command-policy-templates/${editingId}`, {
          ...payload,
          projectId: form.projectId || null,
          environmentId: form.environmentId || null,
        });
      } else {
        await api.post('/server-command-policy-templates', payload);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存执行策略失败');
    } finally {
      setSaving(false);
    }
  };

  const editTemplate = (template: PolicyTemplate) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      description: template.description || '',
      projectId: template.project?.id || '',
      environmentId: template.environment?.id || '',
      enabled: template.enabled,
      priority: String(template.priority ?? 0),
      adapterKeys: readStringArray(template.adapterKeys).join(', '),
      operationKeys: readStringArray(template.operationKeys).join(', '),
      allowedPatterns: readStringArray(template.allowedPatterns).join('\n'),
      blockedPatterns: readStringArray(template.blockedPatterns).join('\n'),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId('');
    setForm(emptyForm);
  };

  const toggleTemplate = async (template: PolicyTemplate) => {
    setActingId(`${template.id}:toggle`);
    setError('');
    try {
      await api.patch(`/server-command-policy-templates/${template.id}`, {
        enabled: !template.enabled,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新策略状态失败');
    } finally {
      setActingId('');
    }
  };

  const deleteTemplate = async (template: PolicyTemplate) => {
    if (!window.confirm(`删除执行策略模板「${template.name}」？`)) return;

    setActingId(`${template.id}:delete`);
    setError('');
    try {
      await api.delete(`/server-command-policy-templates/${template.id}`);
      if (editingId === template.id) resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除执行策略失败');
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
          <h1 className="text-2xl font-bold">执行策略</h1>
          <p className="mt-1 text-muted-foreground">
            管理 Server executor 在团队、项目和环境范围内的命令 allow/block 模板
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
        <Metric label="策略模板" value={stats.total} />
        <Metric label="已启用" value={stats.enabled} />
        <Metric label="限定作用域" value={stats.scoped} />
        <Metric label="Block 规则" value={stats.blockingRules} />
        <Metric label="Allow 规则" value={stats.allowingRules} />
      </div>

      <form onSubmit={saveTemplate} className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {editingId ? '编辑策略模板' : '新建策略模板'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              模板会在危险命令基线之后参与 Server executor 命令判定
            </p>
          </div>
          <div className="flex gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                取消编辑
              </button>
            )}
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
          <label className="space-y-2">
            <span className="text-sm font-medium">名称</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="生产环境 Docker 只读巡检"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">优先级</span>
            <input
              type="number"
              min="0"
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">项目</span>
            <select
              value={form.projectId}
              onChange={(event) => selectProject(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">团队全局</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">环境</span>
            <select
              value={form.environmentId}
              onChange={(event) => {
                const environment = environments.find((item) => item.id === event.target.value);
                setForm((current) => ({
                  ...current,
                  environmentId: event.target.value,
                  projectId: environment?.project?.id || current.projectId,
                }));
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">不限环境</option>
              {environmentOptions.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.project?.name ? `${environment.project.name} / ` : ''}
                  {environment.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Adapter keys</span>
            <input
              value={form.adapterKeys}
              onChange={(event) => setForm((current) => ({ ...current, adapterKeys: event.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="deployment-script-plan, nginx-site-plan"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Operation keys</span>
            <input
              value={form.operationKeys}
              onChange={(event) => setForm((current) => ({ ...current, operationKeys: event.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="deploy, sync-site"
            />
          </label>
          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium">说明</span>
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="限定生产环境只允许健康检查和受控重载"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Allow patterns</span>
            <textarea
              value={form.allowedPatterns}
              onChange={(event) => setForm((current) => ({ ...current, allowedPatterns: event.target.value }))}
              className="min-h-32 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
              placeholder="^docker ps .*"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Block patterns</span>
            <textarea
              value={form.blockedPatterns}
              onChange={(event) => setForm((current) => ({ ...current, blockedPatterns: event.target.value }))}
              className="min-h-32 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
              placeholder="^docker exec .* sh"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          />
          启用策略模板
        </label>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/30 px-4 py-3">
          <h2 className="font-semibold">策略模板列表</h2>
        </div>
        {templates.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            还没有执行策略模板
          </div>
        ) : (
          <div className="divide-y">
            {templates.map((template) => (
              <div key={template.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      <Badge label={template.enabled ? '已启用' : '已停用'} tone={template.enabled ? 'green' : 'gray'} />
                      <Badge label={`P${template.priority}`} tone="blue" />
                      <Badge label={scopeLabel(template)} tone="gray" />
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Adapter: {listLabel(readStringArray(template.adapterKeys))}</span>
                      <span>Operation: {listLabel(readStringArray(template.operationKeys))}</span>
                      <span>Allow {readStringArray(template.allowedPatterns).length}</span>
                      <span>Block {readStringArray(template.blockedPatterns).length}</span>
                      <span>更新 {new Date(template.updatedAt).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => editTemplate(template)}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => toggleTemplate(template)}
                      disabled={actingId === `${template.id}:toggle`}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60"
                    >
                      {template.enabled ? '停用' : '启用'}
                    </button>
                    <button
                      onClick={() => deleteTemplate(template)}
                      disabled={actingId === `${template.id}:delete`}
                      className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <PatternPreview
                  allowed={readStringArray(template.allowedPatterns)}
                  blocked={readStringArray(template.blockedPatterns)}
                />
              </div>
            ))}
          </div>
        )}
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

function Badge({ label, tone }: { label: string; tone: 'green' | 'blue' | 'gray' }) {
  const classes = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[tone]}`}>
      {label}
    </span>
  );
}

function PatternPreview({ allowed, blocked }: { allowed: string[]; blocked: string[] }) {
  if (allowed.length === 0 && blocked.length === 0) return null;

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <PatternList title="Allow" items={allowed} />
      <PatternList title="Block" items={blocked} />
    </div>
  );
}

function PatternList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">无</div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 4).map((item) => (
            <code key={item} className="block break-all rounded bg-muted px-2 py-1 text-xs">
              {item}
            </code>
          ))}
          {items.length > 4 && (
            <div className="text-xs text-muted-foreground">另有 {items.length - 4} 条</div>
          )}
        </div>
      )}
    </div>
  );
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseCsv(value: string): string[] {
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)));
}

function parseLines(value: string): string[] {
  return Array.from(new Set(value.split('\n').map((item) => item.trim()).filter(Boolean)));
}

function listLabel(values: string[]) {
  return values.length ? values.join(', ') : '全部';
}

function scopeLabel(template: PolicyTemplate) {
  if (template.environment) {
    return `环境 ${template.environment.name}`;
  }
  if (template.project) {
    return `项目 ${template.project.name}`;
  }
  return '团队全局';
}
