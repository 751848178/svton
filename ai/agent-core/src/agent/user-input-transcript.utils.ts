import type { AgentMessage } from '@earendil-works/pi-agent-core';

const TOOL_NAME = 'request_user_input';
const REDACTED_RESULT = '[Structured user input submitted]';
const REDACTED_ANSWER = '[redacted]';

export function redactUserInputToolResults(messages: AgentMessage[]): AgentMessage[] {
  return messages.map((message) => {
    if (message.role !== 'toolResult' || message.toolName !== TOOL_NAME) return message;
    const metadata = readMetadata(message.details);
    if (metadata?.containsSecret === false) return message;
    const secretQuestionIds = readSecretQuestionIds(metadata);
    const content = secretQuestionIds
      ? redactStructuredAnswers(message.content, secretQuestionIds)
      : null;
    return {
      ...message,
      content: content ?? [{ type: 'text' as const, text: REDACTED_RESULT }],
    };
  });
}

function redactStructuredAnswers(
  content: unknown,
  secretQuestionIds: string[],
): Array<{ type: 'text'; text: string }> | null {
  if (!Array.isArray(content) || content.length !== 1) return null;
  const block = content[0];
  if (!isRecord(block) || block.type !== 'text' || typeof block.text !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(block.text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.answers)) return null;
  if (secretQuestionIds.some((id) => !Object.prototype.hasOwnProperty.call(parsed.answers, id))) {
    return null;
  }
  const secretIds = new Set(secretQuestionIds);
  const answers = Object.fromEntries(Object.entries(parsed.answers).map(([id, answer]) => [
    id,
    secretIds.has(id) ? { answers: [REDACTED_ANSWER] } : answer,
  ]));
  return [{ type: 'text', text: JSON.stringify({ answers }) }];
}

function readMetadata(details: unknown): Record<string, unknown> | null {
  if (!isRecord(details) || !isRecord(details.metadata)) return null;
  return details.metadata;
}

function readSecretQuestionIds(metadata: Record<string, unknown> | null): string[] | null {
  if (metadata?.containsSecret !== true || !Array.isArray(metadata.secretQuestionIds)) return null;
  const ids = metadata.secretQuestionIds;
  if (ids.length === 0 || !ids.every((id) => typeof id === 'string' && id.length > 0)) return null;
  return [...new Set(ids as string[])];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
