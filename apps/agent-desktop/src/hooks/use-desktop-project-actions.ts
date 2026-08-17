import { useCallback } from 'react';
import type { TauriPlatform } from '@svton/agent-platform';
import type { useAgentContext } from '@svton/agent-client';

interface DesktopProjectActionsInput {
  platform: TauriPlatform;
  projectService: ReturnType<typeof useAgentContext>['projectService'];
  currentSessionId: string | null;
  messageCount: number;
  updateProjectId: (sessionId: string, projectId?: string) => Promise<boolean | void>;
  onReinit?: (workingDir?: string) => void;
}

export function useDesktopProjectActions({
  platform,
  projectService,
  currentSessionId,
  messageCount,
  updateProjectId,
  onReinit,
}: DesktopProjectActionsInput) {
  const openProjectFolder = useCallback(async () => {
    try {
      const api = await import('@tauri-apps/api/core' as string);
      const folderPath = await (api as { invoke: (command: string) => Promise<string | null> })
        .invoke('dialog_open_folder');
      if (!folderPath) return;
      const parts = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
      const project = await projectService.createProject(parts.at(-1) || 'Project', folderPath);
      await projectService.switchProject(project.id);
      await platform.storage.set('agent:workingDir', folderPath);
      onReinit?.(folderPath);
    } catch (error) {
      console.error('Failed to open project folder:', error);
    }
  }, [onReinit, platform.storage, projectService]);

  const switchProject = useCallback(async (id: string | null) => {
    await projectService.switchProject(id);
    const project = id ? projectService.getProjectById(id) : undefined;
    const workingDir = project?.path || platform.process.getEnv('HOME') || '/';
    await platform.storage.set('agent:workingDir', workingDir);
    if (currentSessionId && messageCount === 0) {
      await updateProjectId(currentSessionId, id ?? undefined);
    }
    onReinit?.(workingDir);
  }, [currentSessionId, messageCount, onReinit, platform, projectService, updateProjectId]);

  const deleteProject = useCallback(async (id: string) => {
    await projectService.deleteProject(id);
    if (projectService.currentProjectId === null) {
      await platform.storage.set('agent:workingDir', '/');
      onReinit?.('/');
    }
  }, [onReinit, platform.storage, projectService]);

  return { openProjectFolder, switchProject, deleteProject };
}
