import type {
  ArtifactHostAdapter,
  ReadonlyArtifactTarget,
} from '@svton/agent-ui';

type OpenTarget = Extract<ReadonlyArtifactTarget, { kind: 'file' | 'reference' }>;
type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
interface OpenReport {
  path: string;
  line?: number;
  column?: number;
  lineFocusApplied: boolean;
}

export function createDesktopArtifactHostAdapter(
  workingDir: string,
  injectedInvoke?: Invoke,
): ArtifactHostAdapter {
  const invoke = injectedInvoke ?? invokeTauri;
  return {
    exportCapability: { supported: true },
    presentEditable: async (target) => {
      if (typeof window === 'undefined' || localStorage.getItem('agent:preview_mode') !== 'window') return null;
      const key = Date.now().toString();
      const content = target.kind === 'document'
        ? { type: 'document', title: target.title, content: target.content }
        : { type: 'code', title: target.title, code: target.content, language: target.language };
      try {
        localStorage.setItem(`svton-preview-${key}`, JSON.stringify(content));
        await invoke('popout_preview', { key });
        return { kind: 'succeeded', message: '已在只读预览窗口打开；编辑请使用侧栏预览模式。' };
      } catch {
        localStorage.removeItem(`svton-preview-${key}`);
        return { kind: 'failed', retryable: true, message: '窗口预览失败，已改在侧栏打开。' };
      }
    },
    exportGenerated: async (request) => {
      try {
        const path = await invoke<string | null>('dialog_save_file', { defaultName: request.filename });
        if (!path) return { kind: 'cancelled', message: '已取消另存为。' };
        await invoke('fs_write_file', { path, content: request.content, binary: false });
        return { kind: 'succeeded', message: `已导出当前草稿：${path}` };
      } catch {
        return { kind: 'failed', retryable: true, message: '文件未导出，请重试。' };
      }
    },
    resolveOpenCapability: resolveDesktopOpenCapability,
    openReadonly: async (target) => {
      const capability = resolveDesktopOpenCapability(target);
      if (!capability.supported) return { kind: 'unsupported', message: capability.reason };
      try {
        if (isWebUrl(target.path)) {
          await invoke('artifact_open_url', { url: target.path });
          return { kind: 'succeeded', message: '已在默认浏览器打开链接。' };
        }
        const report = await invoke<OpenReport>('artifact_open_path', {
          path: target.path,
          workingDir,
          line: target.line ?? null,
          column: target.column ?? null,
        });
        return { kind: 'succeeded', message: openPathMessage(report) };
      } catch {
        return { kind: 'failed', retryable: true, message: '目标未打开，请检查路径后重试。' };
      }
    },
  };
}

export function resolveDesktopOpenCapability(target: OpenTarget) {
  if (target.kind === 'file' || !looksLikeUrl(target.path) || isWebUrl(target.path)) {
    return { supported: true } as const;
  }
  return { supported: false, reason: 'Desktop 仅支持本地路径和 http(s) 链接。' } as const;
}

function looksLikeUrl(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(value);
}
function isWebUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch { return false; }
}
function openPathMessage(report: OpenReport): string {
  if (!report.line) return `已打开 ${report.path}`;
  const location = `第 ${report.line} 行${report.column ? `第 ${report.column} 列` : ''}`;
  return report.lineFocusApplied
    ? `已打开 ${report.path} 并定位到${location}`
    : `已打开 ${report.path}；当前主机无法自动定位到${location}。`;
}
async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const api = await import('@tauri-apps/api/core' as string);
  return (api as { invoke: Invoke }).invoke<T>(command, args);
}
