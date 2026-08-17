import { useEffect, useMemo, useState } from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import type { MentionItem } from '@svton/agent-ui';

export function useDesktopMentionItems(config: AgentConfig, platform: TauriPlatform) {
  const [files, setFiles] = useState<MentionItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    void platform.fs.listDir(config.workingDir || '/').then((entries) => {
      if (cancelled) return;
      setFiles(entries.slice(0, 30).map((entry) => ({
        id: `${entry.isFile ? 'file' : 'folder'}:${entry.path}`,
        label: entry.name,
        name: entry.name,
        path: entry.path,
        description: entry.isFile ? '文件' : '目录',
        category: entry.isFile ? 'file' : 'folder',
      })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [config.workingDir, platform.fs]);
  return useMemo<MentionItem[]>(() => [
    ...(config.capabilities?.skillManager?.list() ?? []).map((skill) => ({
      id: `skill:${skill.name}:${skill.source?.type === 'local' ? skill.source.path : skill.scope}`,
      label: skill.name,
      name: skill.name,
      path: skill.source?.type === 'local' ? skill.source.path : `skill:${skill.name}`,
      description: skill.description,
      category: 'skill' as const,
    })),
    ...(config.toolRegistry?.listDefinitions() ?? []).slice(0, 20).map((tool) => ({
      id: `tool:${tool.name}`,
      label: tool.name,
      name: tool.name,
      path: `tool:${tool.name}`,
      description: tool.description,
      category: 'tool' as const,
    })),
    ...files,
  ], [config.capabilities, config.toolRegistry, files]);
}
