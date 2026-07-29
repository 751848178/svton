import type { IRuntime } from '../agent/types';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type {
  AssistantMessage,
  Message,
  Usage,
  UserMessage,
} from '@earendil-works/pi-ai';
import type { TokenUsage } from '../provider/types';
import type { AgentConfig } from '../agent/types';
import type { SubagentConfig } from './types';
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
): Promise<{ messages: AgentMessage[]; usage: TokenUsage }> {
  let finalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for await (const event of runtime.run(task, { signal: controller.signal })) {
      if (event.type === 'message_end' && event.message.role === 'assistant') {
        finalUsage = toTokenUsage(event.message.usage);
      }
    }

  } finally {
    clearTimeout(timer);
  }

  const fullMessages = runtime.getMessages();

  return {
    messages: fullMessages,
    usage: finalUsage,
  };
}

function toTokenUsage(usage: Usage): TokenUsage {
  return {
    promptTokens: usage.input,
    completionTokens: usage.output,
    totalTokens: usage.totalTokens,
  };
}

export async function summarizeSubagentMessages(
  parentConfig: AgentConfig,
  messages: AgentMessage[],
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

function extractLastAssistantText(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    const textParts = (msg as AssistantMessage).content
      .filter((block) => block.type === 'text')
      .map((block) => block.text);
    if (textParts.length > 0) return textParts.join('\n').trim();
  }
  return '';
}

async function summarizeWithLLM(
  parentConfig: AgentConfig,
  text: string,
): Promise<string | null> {
  const prompt: UserMessage = {
    role: 'user',
    content: `Summarize the following subagent output in 3-5 concise sentences. Focus on what was accomplished and any key findings:\n\n${text.slice(0, 8000)}`,
    timestamp: Date.now(),
  };
  const llmMessages: Message[] = [prompt];
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
