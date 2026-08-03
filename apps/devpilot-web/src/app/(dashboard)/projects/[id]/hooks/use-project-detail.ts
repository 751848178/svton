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
import type {
  EnvironmentResourceBulkBindResult,
  EnvironmentResourceBulkBindSelection,
} from '../types/environment-copy';
import {
  buildResourceBulkBindRequest,
  createEmptyResourceBulkBindSelection,
} from '../utils/resource-bulk-bind';
import { shouldReportLoadError } from '../utils/load-error.utils';

export function useProjectDetail(projectId: string, deploymentRunId?: string) {
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
  const [resourceBulkBindPreview, setResourceBulkBindPreview] =
    useState<EnvironmentResourceBulkBindResult | null>(null);
  const [resourceBulkBindResult, setResourceBulkBindResult] =
    useState<EnvironmentResourceBulkBindResult | null>(null);

  const loadProject = usePersistFn(async () => {
    try {
      const data = await apiRequest<Project>(`GET:/projects/${projectId}`);
      setProject(data);
      setError('');
      setEditForm({
        name: data.name,
        description: getProjectDescription(data.config, data.description ?? ''),
      });
      setResourceBulkBindSelection(createEmptyResourceBulkBindSelection());
      setResourceBulkBindPreview(null);
      setSelectedEnvironmentId(
        data.environments?.find((e: { status: string; id: string }) => e.status === 'active')?.id ||
          data.environments?.[0]?.id ||
          '',
      );
    } catch (err) {
      if (shouldReportLoadError(err)) console.error('Failed to load project:', err);
      setProject(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  });

  const loadDeploymentRuns = usePersistFn(async () => {
    try {
      if (deploymentRunId) {
        const run = await apiRequest<DeploymentRun>(
          `GET:/deployments/runs/${deploymentRunId}`,
        );
        setDeploymentRuns([run]);
      } else {
        setDeploymentRuns(await apiRequest<DeploymentRun[]>('GET:/deployments/runs', { projectId }));
      }
      setDeploymentError('');
    } catch (err) {
      if (shouldReportLoadError(err)) console.error('Failed to load deployment runs:', err);
      setDeploymentError(err instanceof Error ? err.message : String(err));
    }
  });

  const loadWebhooks = usePersistFn(async () => {
    try {
      setWebhooks(await apiRequest<ProjectWebhook[]>('GET:/project-webhooks', { projectId }));
      setWebhookError('');
    } catch (err) {
      if (shouldReportLoadError(err)) console.error('Failed to load webhooks:', err);
      setWebhookError(err instanceof Error ? err.message : String(err));
    }
  });

  useEffect(() => {
    loadProject();
    loadDeploymentRuns();
    loadWebhooks();
  }, [deploymentRunId, loadDeploymentRuns, loadProject, loadWebhooks, projectId]);

  const callResourceBulkBind = usePersistFn(
    async (environmentId: string, dryRun: boolean, confirmationText?: string) => {
      if (!projectId || !environmentId) return;
      setBindingResources(true);
      setBindError('');
      try {
        const { resourceTypes, resourceIds } =
          buildResourceBulkBindRequest(resourceBulkBindSelection);
        if (resourceTypes.length === 0) return;
        const result = await apiRequest<EnvironmentResourceBulkBindResult>(
          'POST:/project-environments/resources/bulk-bind',
          {
            projectId,
            environmentId,
            resourceTypes,
            resourceIds,
            dryRun,
            confirmationText,
          },
        );
        if (dryRun) setResourceBulkBindPreview(result);
        else {
          await loadProject();
          setResourceBulkBindResult(result);
          setResourceBulkBindPreview(null);
        }
        return result;
      } catch (err) {
        setBindError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setBindingResources(false);
      }
    },
  );

  const previewResourcesToEnvironment = usePersistFn((environmentId: string) =>
    callResourceBulkBind(environmentId, true),
  );

  const applyResourcesToEnvironment = usePersistFn(
    (environmentId: string, confirmationText: string) =>
      callResourceBulkBind(environmentId, false, confirmationText),
  );

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
    resourceBulkBindPreview,
    resourceBulkBindResult,
    setResourceBulkBindPreview,
    previewResourcesToEnvironment,
    applyResourcesToEnvironment,
    loadProject,
    loadDeploymentRuns,
    loadWebhooks,
  };
}
