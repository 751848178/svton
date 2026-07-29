import { useEffect, useRef } from 'react';
import { useAgentContext, useChat } from '@svton/agent-client';
import { runDesktopE2eDrive } from '@/lib/desktop-e2e-drive.service';
import {
  claimDesktopE2eDrive,
  finishDesktopE2eDrive,
} from '@/lib/desktop-e2e-run-once.service';
import { desktopE2eActive } from '@/lib/e2e-provider';

export function DesktopE2eAutoDrive() {
  const { messages, send, status } = useChat();
  const { chatService, platform } = useAgentContext();
  const latest = useRef({ messages, send, status });
  latest.current = { messages, send, status };

  useEffect(() => {
    if (!desktopE2eActive()) return;
    let controller: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const claimDeadline = Date.now() + 26_000;
    const start = () => {
      if (disposed) return;
      const claim = claimDesktopE2eDrive();
      if (claim.state === 'completed') return;
      if (claim.state === 'waiting') {
        if (Date.now() < claimDeadline) retry = setTimeout(start, 25);
        return;
      }
      const { runId } = claim;
      controller = new AbortController();
      const run = runDesktopE2eDrive({
        platform,
        getModel: () => chatService.currentModel,
        getMessages: () => latest.current.messages,
        getStatus: () => latest.current.status,
        send: (content) => latest.current.send(content),
      }, { signal: controller.signal });
      void run.then((result) => finishDesktopE2eDrive(
        runId,
        result.state === 'passed' ? 'passed' : 'failed',
      ));
    };
    start();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      controller?.abort();
    };
  }, [chatService, platform]);

  return null;
}
