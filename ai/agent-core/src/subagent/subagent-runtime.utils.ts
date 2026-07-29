import type { IRuntime } from '../agent/types';
import type { ChatMessage, TokenUsage } from '../provider/types';
import type { AgentConfig } from '../agent/types';
import type { SubagentConfig } from './types';
import { toAgentMessages } from '../agent/message-bridge';
import { resolveModel } from '../pi/pi-models-factory';

export function seedSubagentRuntimeContext(
  runtime: IRuntime,
  parentRuntime: IRuntime,
  config: SubagentConfig,
): void {
  if (config.isolatedContext !== false) return;
  if (!runtime.setMessages) {
    throw new Error('Subagent runtime does not support non-isolated context.');
  }
  runtime.setMessages(parentRuntime.getMessages());
}

export async function runSubagentRuntime(
  runtime: IRuntime,
  task: string,
  timeoutMs = 120000,
): Promise<{ messages: ChatMessage[]; usage: TokenUsage }> {
  const messages: ChatMessage[] = [];
  let finalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let assistantText = '';

    for await (const event of runtime.run(task, { signal: controller.signal })) {
      switch (event.type) {
        case 'text_delta':
          assistantText += event.text;
          break;
        case 'done':
          finalUsage = event.usage;
          break;
      }
    }

    if (assistantText) {
      messages.push({ role: 'assistant', content: assistantText });
    }
  } finally {
    clearTimeout(timer);
  }

  const fullMessages = runtime.getMessages();

  return {
    messages: fullMessages.length > 0 ? fullMessages : messages,
    usage: finalUsage,
  };
}

export async function summarizeSubagentMessages(
  parentConfig: AgentConfig,
  messages: ChatMessage[],
): Promise<string> {
  const assistantText = extractLastAssistantText(messages);
  if (!assistantText) return 'Subagent completed the task.';

  try {
    const summary = await summarizeWithLLM(parentConfig, assistantText);
    if (summary) return summary;
  } catch {
    // Fall back to direct extraction when summarization is unavailable.
  }

  if (assistantText.length > 2000) {
    return assistantText.slice(0, 2000) + '...';
  }
  return assistantText;
}

function extractLastAssistantText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    if (typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content.trim();
    }
    if (Array.isArray(msg.content)) {
      const textParts = msg.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text);
      if (textParts.length > 0) return textParts.join('\n').trim();
    }
  }
  return '';
}

async function summarizeWithLLM(
  parentConfig: AgentConfig,
  text: string,
): Promise<string | null> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `Summarize the following subagent output in 3-5 concise sentences. Focus on what was accomplished and any key findings:\n\n${text.slice(0, 8000)}`,
    },
  ];

  // PI003: summarize via pi-ai Models.streamSimple (the IProvider path is gone).
  const piMessages = toAgentMessages(messages);
  // `AgentMessage[]` is the pi-agent-core transcript type; pi-ai's
  // `streamSimple` consumes the LLM-facing `Message[]`. The svton AgentMessages
  // here are plain user/assistant text, which map 1:1 onto pi-ai Messages.
  const llmMessages = piMessages as unknown as Parameters<typeof parentConfig.models.streamSimple>[1]['messages'];
  let result = '';
  try {
    const model = parentConfig.piModel ?? resolveModel(parentConfig.models, parentConfig.model, 'openai', { family: 'openai', models: [] });
    const stream = parentConfig.models.streamSimple(model, { messages: llmMessages }, { maxTokens: 1000 });
    for await (const ev of stream) {
      if (ev.type === 'text_delta') result += ev.delta;
    }
  } catch {
    return null;
  }

  return result.trim() || null;
}
