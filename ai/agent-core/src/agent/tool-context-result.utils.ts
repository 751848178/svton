import type { ContextManager } from './context';

export function addToolResultToContext(
  contextManager: ContextManager,
  callId: string,
  output: string,
  isError?: boolean,
): void {
  contextManager.addMessage({
    role: 'tool',
    content: [
      {
        type: 'tool_result',
        toolUseId: callId,
        output,
        isError,
      },
    ],
  });
}
