import { useCallback, useMemo } from 'react';
import { createTimelineHostIntentHandler } from '@svton/agent-app';

const CAPABILITIES = { openTerminal: false, openPath: true } as const;

export function useDesktopTimelineIntents(
  retryFromMessage: (messageId: string) => void | Promise<void>,
  workingDir: string,
) {
  const openReference = useCallback(async (path: string, line?: number) => {
    const api = await import('@tauri-apps/api/core' as string);
    const invoke = (api as any).invoke;
    return invoke('artifact_open_path', {
      path,
      workingDir,
      line: line ?? null,
      column: null,
    });
  }, [workingDir]);
  const onTimelineIntent = useMemo(() => createTimelineHostIntentHandler({
    copy: ({ value }) => navigator.clipboard.writeText(value),
    retry: ({ descriptor }) => retryFromMessage(descriptor.messageId),
    open: ({ target, value }) => target === 'path'
      ? openReference(value).then((report) => ({
          status: 'handled' as const,
          message: report.line && !report.lineFocusApplied
            ? `Opened ${report.path}; this host could not navigate to line ${report.line}.`
            : `Opened ${report.path}`,
        }))
      : {
          status: 'unavailable',
          message: `Open ${target} unavailable in this host`,
        },
  }), [openReference, retryFromMessage]);
  return {
    openReference,
    onTimelineIntent,
    timelineCapabilities: CAPABILITIES,
  };
}
