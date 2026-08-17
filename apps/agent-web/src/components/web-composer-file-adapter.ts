import type { ComposerFileAdapter } from '@svton/agent-ui';
import type { WebComposerFilePresentationCopy } from '@/lib/locale/web-presentation-copy';

export function createWebComposerFileAdapter(
  copy: WebComposerFilePresentationCopy,
): ComposerFileAdapter {
  const files = new Map<string, File>();
  let sequence = 0;
  return {
    capability: { supported: true },
    pick: () => new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'text/*,.ts,.tsx,.js,.jsx,.json,.md,.py,.go,.rs,.java,.c,.cpp,.h,.yml,.yaml,.toml,.ini,.env,.sh';
      let settled = false;
      const finish = (result: Parameters<typeof resolve>[0]) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('focus', detectCancel);
        resolve(result);
      };
      const detectCancel = () => setTimeout(() => {
        if (!input.files?.length) finish({ kind: 'cancelled' });
      }, 0);
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) { finish({ kind: 'cancelled' }); return; }
        const attachment = createWebFileAttachment(file, ++sequence);
        files.set(attachment.id, file);
        finish({
          kind: 'selected',
          attachment,
        });
      };
      window.addEventListener('focus', detectCancel, { once: true });
      input.click();
    }),
    readText: async (attachment) => {
      const file = files.get(attachment.id);
      if (!file) return { kind: 'failed', message: copy.fileHandleUnavailable() };
      try { return { kind: 'succeeded', text: await file.text() }; }
      catch { return { kind: 'failed', message: copy.fileReadFailed() }; }
    },
  };
}

export function createWebFileAttachment(
  file: Pick<File, 'name' | 'size' | 'type' | 'lastModified'>,
  sequence: number,
) {
  return {
    id: `web-file:${file.lastModified}:${file.size}:${sequence}`,
    kind: 'file' as const,
    name: file.name,
    size: file.size,
    mimeType: file.type || undefined,
  };
}
