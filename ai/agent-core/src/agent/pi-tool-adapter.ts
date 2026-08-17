/**
 * Bridge between svton `ToolRegistry` definitions and pi-agent-core `AgentTool`s
 * (Architecture §5.3 — Tools).
 *
 * CONTRACT — who owns what:
 *   Pi Agent OWNS: tool-call argument validation, batch ordering, per-tool
 *     `executionMode` (seq/parallel), streaming progress (`onUpdate`), and
 *     run continuation. Pi calls `AgentTool.execute()` for each tool call.
 *   svton OWNS: the policy pipeline in `ToolExecutionService` — permission,
 *     auto-review, user approval, sandbox selection, platform execution,
 *     pre/post hooks, result redaction + audit metadata (§5.3, §7.4).
 *
 * This bridge:
 *   1. Wraps each registered svton tool as an `AgentTool` whose `execute()`
 *      drains the `ToolExecutionService.execute()` generator. The security
 *      pipeline is the ONLY path to product execution — there is no bypass.
 *   2. Forwards only Svton capability events (currently approval) to the
 *      runtime. Pi emits the tool execution lifecycle and settled result.
 *   3. Bridges Pi's `onUpdate` streaming callback into the executor's
 *      `ToolContext.onProgress`, so a tool that emits partial output surfaces
 *      it through Pi as a native `tool_execution_update`.
 *   4. Passes the Pi-owned schema and explicit execution mode through unchanged.
 *   5. Leaves unspecified tools on the runtime's sequential default.
 *
 * Exports `buildAgentTools` + `ToolEventSink` are stable runtime imports.
 */
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core';
import type { SvtonToolDefinition } from '../tool/types';
import type { ToolRegistry } from '../tool/registry';
import type { SvtonCapabilityEvent } from './types';
import {
  type ToolExecutionService,
} from './tool-executor';
import { settleToolExecution } from './tool-execution-settlement.utils';
import type { ToolCall } from '../tool/types';
import { toPiToolResultContent } from './pi-tool-result-content.utils';
import type { SvtonToolResultDetails } from './pi-tool-result-details.utils';
import { redactSecrets } from './secret-redactor.utils';

/** Callback the runtime installs so tool-execution events reach consumers. */
export type ToolEventSink = (event: SvtonCapabilityEvent) => void;

/** Pi update callback shape (partial AgentToolResult). */
type PiUpdate = (partialResult: AgentToolResult<SvtonToolResultDetails>) => void;

/**
 * Build the `AgentTool[]` set for Pi Agent from the registry. Tools missing a
 * JSON-Schema `parameters` object get a permissive record-shaped schema.
 */
export function buildAgentTools(
  registry: ToolRegistry,
  toolExecService: ToolExecutionService,
  onEvent: ToolEventSink,
): AgentTool[] {
  return registry.listDefinitions().map((def) => toAgentTool(def, toolExecService, onEvent));
}

function toAgentTool(
  def: SvtonToolDefinition,
  toolExecService: ToolExecutionService,
  onEvent: ToolEventSink,
): AgentTool {
  return {
    name: def.name,
    label: def.label ?? def.name,
    description: def.description,
    parameters: def.parameters,
    constrainedSampling: def.constrainedSampling,
    prepareArguments: def.prepareArguments,
    executionMode: def.executionMode,
    async execute(toolCallId, params, signal, onUpdate) {
      // Bridge Pi onUpdate → executor onProgress. When the executor passes
      // onProgress into the tool's ToolContext and the tool calls it with a
      // partial message, we forward a text partialResult to Pi, which emits
      // `tool_execution_update`.
      const onProgress = onUpdate
        ? makeOnProgress(onUpdate, toolCallId, def.name)
        : undefined;
      const arguments_ = toToolArguments(params);
      const call: ToolCall = { id: toolCallId, name: def.name, arguments: arguments_ };
      const result = await settleToolExecution(
        toolExecService.execute(call, signal, onProgress),
        onEvent,
      );
      return {
        content: toPiToolResultContent(result.output),
        details: {
          callId: toolCallId,
          toolName: def.name,
          isError: result.isError === true,
          metadata: result.metadata,
        },
      };
    },
  };
}

/** Wrap Pi's onUpdate so a svton `onProgress(message)` becomes a Pi update. */
function makeOnProgress(
  onUpdate: PiUpdate,
  callId: string,
  toolName: string,
): (message: string) => void {
  return (message) => {
    try {
      onUpdate({
        content: [{ type: 'text', text: redactSecrets(message) }],
        details: { callId, toolName, isError: false },
      });
    } catch {
      // onUpdate is scoped to the active execute() call; calls after settle
      // are ignored by Pi, and a throwing callback must never break the tool.
    }
  };
}

function toToolArguments(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {};
  return Object.fromEntries(Object.entries(params));
}
