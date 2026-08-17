import { useMemo } from 'react';
import { createTimelineHostIntentHandler } from './timeline-host-intents';

const CAPABILITIES = { openTerminal: false, openPath: false } as const;

export function useAgentShellTimelineIntents(
  retryFromMessage: (messageId: string) => void | Promise<void>,
) {
  return useMemo(() => ({
    onTimelineIntent: createTimelineHostIntentHandler({
      copy: ({ value }) => navigator.clipboard.writeText(value),
      retry: ({ descriptor }) => retryFromMessage(descriptor.messageId),
    }),
    timelineCapabilities: CAPABILITIES,
  }), [retryFromMessage]);
}
