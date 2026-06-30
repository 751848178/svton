/**
 * 执行策略数据 Hook
 *
 * 单一职责：策略模板与项目/环境的加载、CRUD、状态切换。
 * 表单状态用 useSetState 统一管理。
 */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type {
  PolicyTemplate,
  Project,
  ProjectEnvironment,
  PolicyForm,
  PolicyStats,
} from '../types';
import { EMPTY_FORM, parseCsv, parseLines, readStringArray, templateToForm } from '../utils';

export function usePolicies() {
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [form, setForm] = useSetState<PolicyForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');

  const load = usePersistFn(async () => {
    setError('');
    try {
      const [t, p, e] = await Promise.all([
        apiRequest<PolicyTemplate[]>('GET:/server-command-policy-templates'),
        apiRequest<Project[]>('GET:/projects'),
        apiRequest<ProjectEnvironment[]>('GET:/project-environments', { status: 'active' }),
      ]);
      setTemplates(t);
      setProjects(p);
      setEnvironments(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载执行策略失败');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo<PolicyStats>(
    () => ({
      total: templates.length,
      enabled: templates.filter((t) => t.enabled).length,
      scoped: templates.filter((t) => t.project || t.environment).length,
      blockingRules: templates.reduce((s, t) => s + readStringArray(t.blockedPatterns).length, 0),
      allowingRules: templates.reduce((s, t) => s + readStringArray(t.allowedPatterns).length, 0),
    }),
    [templates],
  );

  const environmentOptions = useMemo(
    () => environments.filter((e) => !form.projectId || e.project?.id === form.projectId),
    [environments, form.projectId],
  );

  const selectProject = usePersistFn((projectId: string) => {
    const envStillMatches = environments.some(
      (e) => e.id === form.environmentId && (!projectId || e.project?.id === projectId),
    );
    setForm((cur) => ({
      ...cur,
      projectId,
      environmentId: envStillMatches ? cur.environmentId : '',
    }));
  });

  const save = usePersistFn(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
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
      if (!payload.name) throw new Error('请填写策略模板名称');
      if (editingId) {
        await apiRequest(`PATCH:/server-command-policy-templates/${editingId}`, {
          ...payload,
          projectId: form.projectId || null,
          environmentId: form.environmentId || null,
        });
      } else {
        await apiRequest('POST:/server-command-policy-templates', payload);
      }
      setEditingId('');
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存执行策略失败');
    } finally {
      setSaving(false);
    }
  });

  const edit = usePersistFn((template: PolicyTemplate) => {
    setEditingId(template.id);
    setForm(templateToForm(template));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const reset = usePersistFn(() => {
    setEditingId('');
    setForm(EMPTY_FORM);
  });

  const toggle = usePersistFn(async (template: PolicyTemplate) => {
    setActingId(`${template.id}:toggle`);
    setError('');
    try {
      await apiRequest(`PATCH:/server-command-policy-templates/${template.id}`, {
        enabled: !template.enabled,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新策略状态失败');
    } finally {
      setActingId('');
    }
  });

  const remove = usePersistFn(async (template: PolicyTemplate) => {
    if (!window.confirm(`删除执行策略模板「${template.name}」？`)) return;
    setActingId(`${template.id}:delete`);
    setError('');
    try {
      await apiRequest(`DELETE:/server-command-policy-templates/${template.id}`);
      if (editingId === template.id) reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除执行策略失败');
    } finally {
      setActingId('');
    }
  });

  return {
    templates,
    projects,
    environments,
    environmentOptions,
    form,
    setForm,
    editingId,
    loading,
    saving,
    actingId,
    error,
    stats,
    selectProject,
    save,
    edit,
    reset,
    toggle,
    remove,
    reload: load,
  };
}
