/**
 * 项目详情数据 Hook
 *
 * 单一职责：加载项目详情、部署运行与 Webhook 列表，
 * 暴露加载错误状态供页面渲染 ErrorBanner 重试。
 */

import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { getProjectDescription } from '@/lib/project-display';
import type { Project } from '../types';
import type { DeploymentRun, ProjectWebhook } from '../types/operations';
import type { EnvironmentResourceBulkBindSelection } from '../types/environment-copy';
import {
  buildResourceBulkBindRequest,
  createEmptyResourceBulkBindSelection,
  createResourceBulkBindSelection,
} from '../utils/resource-bulk-bind';

export function useProjectDetail(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [deploymentRuns, setDeploymentRuns] = useState<DeploymentRun[]>([]);
  const [webhooks, setWebhooks] = useState<ProjectWebhook[]>([]);
  const [error, setError] = useState('');
  const [deploymentError, setDeploymentError] = useState('');
  const [webhookError, setWebhookError] = useState('');
  const [resourceBulkBindSelection, setResourceBulkBindSelection] =
    useState<EnvironmentResourceBulkBindSelection>(createEmptyResourceBulkBindSelection);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [bindingResources, setBindingResources] = useState(false);
  const [bindError, setBindError] = useState('');

  const loadProject = usePersistFn(async () => {
    try {
      const data = await apiRequest<Project>(`GET:/projects/${projectId}`);
      setProject(data);
      setError('');
      setEditForm({
        name: data.name,
        description: getProjectDescription(data.config, data.description ?? ''),
      });
      setResourceBulkBindSelection(createResourceBulkBindSelection(data));
      setSelectedEnvironmentId(
        data.environments?.find((e: { status: string; id: string }) => e.status === 'active')?.id ||
          data.environments?.[0]?.id ||
          '',
      );
    } catch (err) {
      console.error('Failed to load project:', err);
      setProject(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  });

  const loadDeploymentRuns = usePersistFn(async () => {
    try {
      setDeploymentRuns(await apiRequest<DeploymentRun[]>('GET:/deployments/runs', { projectId }));
      setDeploymentError('');
    } catch (err) {
      console.error('Failed to load deployment runs:', err);
      setDeploymentError(err instanceof Error ? err.message : String(err));
    }
  });

  const loadWebhooks = usePersistFn(async () => {
    try {
      setWebhooks(await apiRequest<ProjectWebhook[]>('GET:/project-webhooks', { projectId }));
      setWebhookError('');
    } catch (err) {
      console.error('Failed to load webhooks:', err);
      setWebhookError(err instanceof Error ? err.message : String(err));
    }
  });

  useEffect(() => {
    loadProject();
    loadDeploymentRuns();
    loadWebhooks();
  }, [loadDeploymentRuns, loadProject, loadWebhooks, projectId]);

  /**
   * 把当前选中的资源绑定到目标环境(POST /project-environments/resources/bulk-bind)。
   * 后端已实现:鉴权 + dryRun + 确认文案守卫;此前前端只有选择状态、无调用点(dead code)。
   * 成功后重载项目,使资源面板反映新的绑定关系 —— 回答 issue #11「资源能否关联项目供部署直接配置」。
   */
  const bindResourcesToEnvironment = usePersistFn(async (environmentId: string) => {
    if (!projectId || !environmentId) return;
    setBindingResources(true);
    setBindError('');
    try {
      const { resourceTypes, resourceIds } = buildResourceBulkBindRequest(resourceBulkBindSelection);
      if (resourceTypes.length === 0) return;
      await apiRequest('POST:/project-environments/resources/bulk-bind', {
        projectId,
        environmentId,
        resourceTypes,
        resourceIds,
      });
      await loadProject();
    } catch (err) {
      setBindError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBindingResources(false);
    }
  });

  return {
    project,
    loading,
    editing,
    setEditing,
    editForm,
    setEditForm,
    deploymentRuns,
    webhooks,
    error,
    deploymentError,
    webhookError,
    resourceBulkBindSelection,
    setResourceBulkBindSelection,
    selectedEnvironmentId,
    setSelectedEnvironmentId,
    bindingResources,
    bindError,
    bindResourcesToEnvironment,
    loadProject,
    loadDeploymentRuns,
    loadWebhooks,
  };
}
