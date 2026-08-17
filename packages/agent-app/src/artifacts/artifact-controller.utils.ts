import type {
  ArtifactHostAdapter,
  ArtifactHostResult,
  ArtifactIntent,
  ArtifactResult,
} from '@svton/agent-ui';

export const UNSUPPORTED_ARTIFACT_HOST: ArtifactHostAdapter = {
  exportCapability: { supported: false, reason: '当前主机不支持导出。' },
  exportGenerated: async () => ({ kind: 'unsupported', message: '当前主机不支持导出。' }),
  resolveOpenCapability: () => ({ supported: false, reason: '当前主机不支持打开本地目标。' }),
  openReadonly: async () => ({ kind: 'unsupported', message: '当前主机不支持打开本地目标。' }),
};

export function succeeded(id: string, message: string): ArtifactResult {
  return { id, kind: 'succeeded', message };
}
export function cancelled(id: string, message: string): ArtifactResult {
  return { id, kind: 'cancelled', message };
}
export function unsupported(id: string, message: string): ArtifactResult {
  return { id, kind: 'unsupported', message };
}
export function withArtifactResultId(id: string, result: ArtifactHostResult): ArtifactResult {
  return { id, ...result } as ArtifactResult;
}

export function currentArtifactOpener(): HTMLElement | null {
  const candidate = currentFocusedElement();
  return candidate && !candidate.closest('[data-artifact-panel]')
    ? candidate
    : null;
}

export function currentFocusedElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function captureArtifactIntentFocus(
  intent: ArtifactIntent,
  previousOpener: HTMLElement | null,
): { opener: HTMLElement | null; confirmation?: HTMLElement | null } {
  if (intent.kind === 'artifact.open') {
    const focused = currentArtifactOpener();
    return { opener: focused ?? previousOpener, confirmation: focused ?? currentFocusedElement() };
  }
  if (intent.kind === 'artifact.close') {
    return { opener: previousOpener, confirmation: currentFocusedElement() };
  }
  return { opener: previousOpener };
}

export function restoreArtifactOpener(previous: HTMLElement | null): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    const fallback = document.querySelector<HTMLElement>('[data-testid="chat-input"]');
    const artifactId = previous?.dataset.artifactTargetId;
    const equivalent = artifactId
      ? Array.from(document.querySelectorAll<HTMLElement>('[data-artifact-target-id]'))
        .find((candidate) => candidate.dataset.artifactTargetId === artifactId)
      : null;
    const target = previous?.isConnected ? previous : equivalent ?? fallback;
    if (target && !('disabled' in target && Boolean((target as HTMLButtonElement).disabled))) target.focus();
  }, 0);
}
