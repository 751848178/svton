/**
 * 访问策略数据 Hook
 *
 * 单一职责：策略与项目/环境的加载、CRUD、状态切换。
 */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type {
  AccessPolicy,
  ProjectRef,
  ProjectEnvironmentRef,
  PolicyForm,
  PolicyStats,
} from '../types';
import { EMPTY_FORM } from '../types';
import { parseCsv, policyToForm } from '../utils';

export function useAccessPolicies() {
  const t = useTranslations('accessPolicies');
  const [policies, setPolicies] = useState<AccessPolicy[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [environments, setEnvironments] = useState<ProjectEnvironmentRef[]>([]);
  const [form, setForm] = useSetState<PolicyForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AccessPolicy | null>(null);

  const load = usePersistFn(async () => {
    setError('');
    try {
      const [p, proj, env] = await Promise.all([
        apiRequest<AccessPolicy[]>('GET:/control-access-policies'),
        apiRequest<ProjectRef[]>('GET:/projects'),
        apiRequest<ProjectEnvironmentRef[]>('GET:/project-environments', { status: 'active' }),
      ]);
      setPolicies(p);
      setProjects(proj);
      setEnvironments(env);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载访问策略失败');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo<PolicyStats>(
    () => ({
      total: policies.length,
      enabled: policies.filter((p) => p.enabled).length,
      denies: policies.filter((p) => p.effect === 'deny').length,
      scoped: policies.filter((p) => p.project || p.environment).length,
      userScoped: policies.filter((p) => p.principalType === 'user').length,
    }),
    [policies],
  );

  const environmentOptions = useMemo(
    () => environments.filter((e) => !form.projectId || e.project?.id === form.projectId),
    [environments, form.projectId],
  );

  const selectProject = usePersistFn((projectId: string) => {
    const stillMatches = environments.some(
      (e) => e.id === form.environmentId && (!projectId || e.project?.id === projectId),
    );
    setForm((cur) => ({ ...cur, projectId, environmentId: stillMatches ? cur.environmentId : '' }));
  });

  const save = usePersistFn(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
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
      if (!payload.name) throw new Error(t('nameRequired'));
      if (payload.principalType === 'user' && !payload.principalUserId)
        throw new Error(t('userIdRequired'));
      if (editingId) {
        await apiRequest(`PATCH:/control-access-policies/${editingId}`, {
          ...payload,
          principalRole: form.principalType === 'team_role' ? form.principalRole : null,
          principalUserId: form.principalType === 'user' ? form.principalUserId.trim() : null,
          projectId: form.projectId || null,
          environmentId: form.environmentId || null,
        });
      } else {
        await apiRequest('POST:/control-access-policies', payload);
      }
      setEditingId('');
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存访问策略失败');
    } finally {
      setSaving(false);
    }
  });

  const edit = usePersistFn((policy: AccessPolicy) => {
    setEditingId(policy.id);
    setForm(policyToForm(policy));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const reset = usePersistFn(() => {
    setEditingId('');
    setForm(EMPTY_FORM);
  });

  const toggle = usePersistFn(async (policy: AccessPolicy) => {
    setActingId(`${policy.id}:toggle`);
    setError('');
    try {
      await apiRequest(`PATCH:/control-access-policies/${policy.id}`, { enabled: !policy.enabled });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新访问策略状态失败');
    } finally {
      setActingId('');
    }
  });

  const remove = usePersistFn((policy: AccessPolicy) => {
    setDeleteTarget(policy);
  });

  const cancelRemove = usePersistFn(() => {
    setDeleteTarget(null);
  });

  const confirmRemove = usePersistFn(async () => {
    if (!deleteTarget) return;
    setActingId(`${deleteTarget.id}:delete`);
    setError('');
    try {
      await apiRequest(`DELETE:/control-access-policies/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) reset();
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除访问策略失败');
    } finally {
      setActingId('');
    }
  });

  return {
    policies,
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
    deleteTarget,
    stats,
    selectProject,
    save,
    edit,
    reset,
    toggle,
    remove,
    cancelRemove,
    confirmRemove,
    reload: load,
  };
}
