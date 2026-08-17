import type { UserMessage } from '@earendil-works/pi-ai';

export const RUNTIME_SKILL_CONTEXT_PREFIX = [
  '[Skill Context Activated]',
  'The following skills are relevant to your request:',
  '',
].join('\n');

interface RuntimeMessageLike {
  role: string;
  content: unknown;
}

/** Create the canonical/model-only user message that carries activated skill instructions. */
export function createRuntimeSkillContextMessage(
  blocks: string[],
  timestamp = Date.now(),
): UserMessage {
  return {
    role: 'user',
    content: `${RUNTIME_SKILL_CONTEXT_PREFIX}\n${blocks.join('\n\n')}`,
    timestamp,
  };
}

/** Identify only the reserved runtime-injected skill context shape. */
export function isRuntimeSkillContextMessage(message: RuntimeMessageLike): boolean {
  return message.role === 'user'
    && typeof message.content === 'string'
    && message.content.startsWith(`${RUNTIME_SKILL_CONTEXT_PREFIX}\n`);
}
