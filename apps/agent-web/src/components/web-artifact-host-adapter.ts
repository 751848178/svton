import type {
  ArtifactHostAdapter,
  ReadonlyArtifactTarget,
} from '@svton/agent-ui';
import type { WebArtifactPresentationCopy } from '@/lib/locale/web-presentation-copy';

type OpenTarget = Extract<ReadonlyArtifactTarget, { kind: 'file' | 'reference' }>;

export function createWebArtifactHostAdapter(
  copy: WebArtifactPresentationCopy,
): ArtifactHostAdapter {
  return {
    exportCapability: { supported: true },
    exportGenerated: async (request) => {
      try {
        const href = URL.createObjectURL(new Blob([request.content], { type: request.mimeType }));
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.download = request.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(href);
        return { kind: 'succeeded', message: copy.exportDownloaded(request.filename) };
      } catch {
        return { kind: 'failed', retryable: true, message: copy.exportFailed() };
      }
    },
    resolveOpenCapability: (target) => resolveWebOpenCapability(target, copy),
    openReadonly: async (target) => {
      const capability = resolveWebOpenCapability(target, copy);
      if (!capability.supported) return { kind: 'unsupported', message: capability.reason };
      try {
        const opened = window.open(target.path, '_blank');
        if (!opened) return { kind: 'failed', retryable: true, message: copy.popupBlocked() };
        opened.opener = null;
        return { kind: 'succeeded', message: copy.openSucceeded() };
      } catch {
        return { kind: 'failed', retryable: true, message: copy.openFailed() };
      }
    },
  };
}

export function resolveWebOpenCapability(
  target: OpenTarget,
  copy: WebArtifactPresentationCopy,
) {
  if (target.kind === 'file') {
    return { supported: false, reason: copy.localFileUnsupported() } as const;
  }
  try {
    const protocol = new URL(target.path).protocol;
    if (protocol === 'http:' || protocol === 'https:') return { supported: true } as const;
  } catch {
    // A local or malformed reference is intentionally unsupported in Web.
  }
  if (/^(?:\.?\.?\/|[a-z]:[\\/])/i.test(target.path)) {
    return { supported: false, reason: copy.localPathUnsupported() } as const;
  }
  return { supported: false, reason: copy.httpOnly() } as const;
}
