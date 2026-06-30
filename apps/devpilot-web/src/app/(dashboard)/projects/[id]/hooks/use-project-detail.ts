/**
 * 项目详情数据 Hook
 *
 * 单一职责：加载项目详情/服务器/凭证/部署运行/Webhook/环境同步建议，
 * 提供部署/Webhook/环境同步/资源复制等操作。
 */

import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { getProjectDescription } from '@/lib/project-display';
import type { Project } from '../types';
import type {
  ProjectServerOption,
  TeamCredentialOption,
  DeploymentRun,
  ProjectWebhook,
} from '../types/operations';
import type { EnvironmentSyncSuggestions } from '../types/environment-sync';
import type { EnvironmentResourceBulkBindSelection } from '../types/environment-copy';
import {
  createEmptyResourceBulkBindSelection,
  createResourceBulkBindSelection,
} from '../utils/resource-bulk-bind';

export function useProjectDetail(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [downloadingArtifact, setDownloadingArtifact] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [servers, setServers] = useState<ProjectServerOption[]>([]);
  const [teamCredentials, setTeamCredentials] = useState<TeamCredentialOption[]>([]);
  const [deploymentRuns, setDeploymentRuns] = useState<DeploymentRun[]>([]);
  const [webhooks, setWebhooks] = useState<ProjectWebhook[]>([]);
  const [environmentSyncSuggestions, setEnvironmentSyncSuggestions] =
    useState<EnvironmentSyncSuggestions | null>(null);
  const [error, setError] = useState('');
  const [resourceBulkBindSelection, setResourceBulkBindSelection] =
    useState<EnvironmentResourceBulkBindSelection>(createEmptyResourceBulkBindSelection);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');

  const loadProject = usePersistFn(async () => {
    try {
      const data = await apiRequest<Project>(`GET:/projects/${projectId}`);
      setProject(data);
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
    } finally {
      setLoading(false);
    }
  });

  const loadServers = usePersistFn(async () => {
    try {
      setServers(await apiRequest<ProjectServerOption[]>('GET:/servers'));
    } catch (err) {
      console.error('Failed to load servers:', err);
    }
  });

  const loadTeamCredentials = usePersistFn(async () => {
    try {
      setTeamCredentials(await apiRequest<TeamCredentialOption[]>('GET:/team-credentials'));
    } catch (err) {
      console.error('Failed to load credentials:', err);
    }
  });

  const loadEnvironmentSyncSuggestions = usePersistFn(async () => {
    try {
      setEnvironmentSyncSuggestions(
        await apiRequest<EnvironmentSyncSuggestions>('/project-environments/sync-suggestions', {
          projectId,
        }),
      );
    } catch (err) {
      console.error('Failed to load sync suggestions:', err);
      setEnvironmentSyncSuggestions(null);
    }
  });

  useEffect(() => {
    loadProject();
    loadServers();
    loadTeamCredentials();
    loadEnvironmentSyncSuggestions();
  }, [projectId]);

  return {
    project,
    loading,
    editing,
    setEditing,
    downloadingArtifact,
    setDownloadingArtifact,
    editForm,
    setEditForm,
    servers,
    teamCredentials,
    deploymentRuns,
    webhooks,
    environmentSyncSuggestions,
    error,
    setError,
    resourceBulkBindSelection,
    setResourceBulkBindSelection,
    selectedEnvironmentId,
    setSelectedEnvironmentId,
    loadProject,
    loadServers,
    loadTeamCredentials,
    loadEnvironmentSyncSuggestions,
  };
}
