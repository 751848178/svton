/**
 * Tool-result context bridge.
 *
 * PI003: Pi Agent owns the message list and appends tool-result messages
 * itself (built from the AgentToolResult returned by the tool wrapper). The
 * legacy ContextManager.append path is gone, so this module now exposes only
 * the callback shape the ToolExecutionService uses to report results that
 * must bypass Pi's automatic append (e.g. denied/blocked calls whose result
 * the wrapper still returns to Pi). In practice the callback is a no-op for
 * the normal path because Pi records the result from the AgentToolResult.
 */

export type ToolResultSink = (callId: string, output: string, isError?: boolean) => void;

/** No-op sink — Pi Agent records tool results from the AgentToolResult. */
export const noopToolResultSink: ToolResultSink = () => {};
