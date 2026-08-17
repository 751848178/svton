import { useCallback, useMemo } from 'react';
import { createTimelineHostIntentHandler } from '@svton/agent-app';

const CAPABILITIES = { openTerminal: false, openPath: false } as const;

export function createWebTimelineIntentHandler(
  retryFromMessage: (messageId: string) => void | Promise<void>,
) {
  return createTimelineHostIntentHandler({
    copy: ({ value }) => navigator.clipboard.writeText(value),
    open: () => ({ status: 'unavailable', message: 'open unavailable in this host' }),
    retry: ({ descriptor }) => retryFromMessage(descriptor.messageId),
  });
}

export function useWebTimelineIntents(
  retryFromMessage: (messageId: string) => void | Promise<void>,
) {
  const openReference = useCallback((path: string) => {
    if (path.startsWith('http')) window.open(path, '_blank');
    else void navigator.clipboard.writeText(path);
  }, []);
  const onTimelineIntent = useMemo(
    () => createWebTimelineIntentHandler(retryFromMessage),
    [retryFromMessage],
  );
  return {
    openReference,
    onTimelineIntent,
    timelineCapabilities: CAPABILITIES,
  };
}
