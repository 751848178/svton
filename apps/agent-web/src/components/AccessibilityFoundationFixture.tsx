'use client';

import { useEffect, useState } from 'react';
import { ChatPanel, ToolApprovalModal, type ChatPanelMessage } from '@svton/agent-ui';
import type { ApprovalDecisionView, ApprovalRequestView } from '@svton/agent-ui';
import { Drawer, Modal } from '@svton/ui';

const noCancelRequest: ApprovalRequestView = {
  sessionId: 'accessibility-fixture', requestId: 'no-cancel', itemId: 'fixture-tool',
  createdAt: 1, toolName: 'e2e_approval', arguments: { command: 'safe fixture' },
  decisions: ['accept', 'decline'],
};
const initialMessages: ChatPanelMessage[] = [
  { id: 'fixture-user', role: 'user', content: 'Run the accessibility fixture.' },
  { id: 'fixture-assistant', role: 'assistant', content: 'Working', isStreaming: false },
];

/** Test-only deterministic surface for contracts the production faux provider cannot emit. */
export function AccessibilityFoundationFixture() {
  const [enabled, setEnabled] = useState(false);
  const [approval, setApproval] = useState(false);
  const [overlay, setOverlay] = useState<'modal' | 'drawer' | null>(null);
  const [decision, setDecision] = useState('none');
  const [messages, setMessages] = useState<ChatPanelMessage[]>(initialMessages);
  const [streaming, setStreaming] = useState(true);
  useEffect(() => {
    setEnabled(Boolean(window.localStorage.getItem('agent-web:e2e')));
  }, []);
  if (!enabled) return <main>Fixture unavailable.</main>;

  const updateAssistant = (change: Partial<ChatPanelMessage>) => {
    setMessages((current) => current.map((message) => message.id === 'fixture-assistant'
      ? { ...message, ...change } : message));
  };
  const settle = (requestId: string, next: ApprovalDecisionView) => {
    setDecision(`${requestId}:${next}`);
    setApproval(false);
  };
  return (
    <main className="flex h-screen flex-col bg-background p-4 text-foreground" data-testid="accessibility-fixture">
      <nav className="mb-3 flex flex-wrap gap-3" aria-label="Accessibility fixture controls">
        <button type="button" onClick={() => setApproval(true)} className="rounded border border-input px-3 py-2">Open no-cancel approval</button>
        <button type="button" onClick={() => setOverlay('modal')} className="rounded border border-input px-3 py-2">Open shared modal</button>
        <button type="button" onClick={() => setOverlay('drawer')} className="rounded border border-input px-3 py-2">Open shared drawer</button>
        <button type="button" onClick={() => updateAssistant({ content: `${messages[1]?.content} token` })} className="rounded border border-input px-3 py-2">Append token</button>
        <button type="button" onClick={() => { updateAssistant({ content: 'Completed', isStreaming: false }); setStreaming(false); }} className="rounded border border-input px-3 py-2">Complete run</button>
        <button type="button" onClick={() => { updateAssistant({ content: 'Working again', blocks: undefined, isStreaming: false }); setStreaming(true); }} className="rounded border border-input px-3 py-2">Start error run</button>
        <button type="button" onClick={() => { updateAssistant({ blocks: [{ type: 'error', text: 'Deterministic provider failure' }], isStreaming: false }); setStreaming(false); }} className="rounded border border-input px-3 py-2">Surface error</button>
      </nav>
      <output data-testid="fixture-decision">{decision}</output>
      <section className="min-h-0 flex-1 border border-border" aria-label="Chat fixture">
        <ChatPanel messages={messages} onSend={() => undefined} isStreaming={streaming} />
      </section>
      {approval && <ToolApprovalModal request={noCancelRequest} onDecision={settle} />}
      <Modal open={overlay === 'modal'} onClose={() => setOverlay(null)} title="Reduced-motion modal" testId="reduced-motion-modal">
        <button type="button" onClick={() => setOverlay(null)}>Close modal fixture</button>
      </Modal>
      <Drawer open={overlay === 'drawer'} onClose={() => setOverlay(null)} title="Reduced-motion drawer">
        <button type="button" onClick={() => setOverlay(null)}>Close drawer fixture</button>
      </Drawer>
    </main>
  );
}
