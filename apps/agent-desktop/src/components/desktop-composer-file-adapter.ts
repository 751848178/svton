import type { ComposerFileAdapter } from '@svton/agent-ui';

export function createDesktopComposerFileAdapter(): ComposerFileAdapter {
  return {
    capability: { supported: true },
    pick: async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core' as string);
        const path = await invoke('dialog_open_file') as string | null;
        if (!path) return { kind: 'cancelled' };
        const stat = await invoke('fs_stat', { path }) as { is_file: boolean; size: number };
        if (!stat.is_file) return { kind: 'failed', message: '请选择可读取的文本文件。' };
        return {
          kind: 'selected',
          attachment: {
            id: `file:${path}`,
            kind: 'file',
            name: path.replace(/\\/g, '/').split('/').pop() || 'file',
            path,
            size: stat.size,
          },
        };
      } catch {
        return { kind: 'failed', message: '无法打开或读取所选文件，请检查权限后重试。' };
      }
    },
    readText: async (attachment) => {
      if (!attachment.path) return { kind: 'failed', message: '文件路径不可用，请移除后重新选择。' };
      try {
        const { invoke } = await import('@tauri-apps/api/core' as string);
        const text = await invoke('fs_read_file', { path: attachment.path }) as string;
        return { kind: 'succeeded', text };
      } catch {
        return { kind: 'failed', message: '文件读取失败，请检查权限后重试；附件已保留。' };
      }
    },
  };
}
