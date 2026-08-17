import type { SvtonAgentRuntime } from '@svton/agent-core';
import type { DisplayMessage } from '../types';
import type { MessageEditPlan } from './chat-commands';
import { rollbackRuntimeForMessage } from './chat-runtime-history.service';

interface MessageEditHost {
  messages: DisplayMessage[];
  canSend: boolean;
}

/** Rolls canonical runtime history back before delegating the replacement run. */
export async function runChatMessageEdit(
  host: MessageEditHost,
  runtime: SvtonAgentRuntime | null,
  plan: MessageEditPlan | null,
  runAssistant: (prompt: string, images?: Array<{ data: string; mimeType?: string }>) => Promise<void>,
): Promise<void> {
  if (!runtime || !host.canSend || !plan) return;
  const messages = rollbackRuntimeForMessage(runtime, host.messages, plan);
  if (!messages) return;
  host.messages = messages;
  await runAssistant(plan.prompt, plan.images);
}
