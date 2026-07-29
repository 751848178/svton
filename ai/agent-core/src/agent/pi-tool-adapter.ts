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
 *   2. Forwards every yielded svton `AgentEvent` (tool_approval_needed,
 *      tool_call_end, …) to the runtime via `onEvent`, so the runtime's Pi
 *      event subscriber can surface them to consumers.
 *   3. Bridges Pi's `onUpdate` streaming callback into the executor's
 *      `ToolContext.onProgress`, so a tool that emits partial output surfaces
 *      it through Pi as `tool_execution_update` (the runtime event adapter
 *      maps that to svton `tool_call_progress`).
 *   4. Normalizes the JSON-Schema `parameters` so pi-ai's TypeBox validator
 *      always sees `type:'object'` + `properties`, and strips svton-only
 *      `annotations` (they feed `executionMode`, not the LLM-visible schema).
 *   5. Maps svton `ToolAnnotations` → Pi `executionMode` (§5.3): destructive
 *      tools are sequential; proven read-only tools MAY opt into parallel.
 *
 * Exports `buildAgentTools` + `ToolEventSink` are stable runtime imports.
 */
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core';
import type { ToolDefinition, ToolAnnotations } from '../provider/types';
import type { ToolRegistry } from '../tool/registry';
import type { AgentEvent } from './types';
import type { ToolExecutionService } from './tool-executor';
import type { ToolCall } from '../tool/types';

/** Callback the runtime installs so tool-execution events reach consumers. */
export type ToolEventSink = (event: AgentEvent) => void;

/** Pi update callback shape (partial AgentToolResult). */
type PiUpdate = (partialResult: AgentToolResult<unknown>) => void;

/**
 * Build the `AgentTool[]` set for Pi Agent from the registry. Tools missing a
 * JSON-Schema `parameters` object get a permissive `Record<string, any>` schema.
 */
export function buildAgentTools(
  registry: ToolRegistry,
  toolExecService: ToolExecutionService,
  onEvent: ToolEventSink,
): AgentTool[] {
  return registry.listDefinitions().map((def) => toAgentTool(def, toolExecService, onEvent));
}

function toAgentTool(
  def: ToolDefinition,
  toolExecService: ToolExecutionService,
  onEvent: ToolEventSink,
): AgentTool {
  return {
    name: def.name,
    label: def.name,
    description: def.description,
    parameters: normalizeParameters(def),
    executionMode: annotationsToExecutionMode(def.annotations),
    async execute(toolCallId, params, signal, onUpdate) {
      // Bridge Pi onUpdate → executor onProgress. When the executor passes
      // onProgress into the tool's ToolContext and the tool calls it with a
      // partial message, we forward a text partialResult to Pi, which emits
      // `tool_execution_update` (the runtime maps it to tool_call_progress).
      const onProgress = onUpdate ? makeOnProgress(onUpdate as PiUpdate) : undefined;
      // `params` is `Static<TParameters>` (a validated object); coerce to the
      // record shape `ToolCall.arguments` expects. Default to an empty record
      // when Pi passes no arguments for a no-param tool.
      const arguments_ = (params ?? {}) as Record<string, unknown>;
      const call: ToolCall = { id: toolCallId, name: def.name, arguments: arguments_ };
      let lastError = false;
      let lastOutput = '';
      for await (const ev of toolExecService.execute(call, signal, onProgress)) {
        onEvent(ev);
        if (ev.type === 'tool_call_end') {
          lastError = ev.result.isError === true;
          lastOutput = ev.result.output;
        }
      }
      // Pi expects execute() to resolve to an AgentToolResult. The executor
      // already recorded the result via its sink path; here we return the
      // textual content Pi appends as the tool-result message.
      return {
        content: [{ type: 'text', text: lastOutput }],
        details: { callId: toolCallId, isError: lastError },
        isError: lastError,
      } as AgentToolResult<unknown>;
    },
  };
}

/** Wrap Pi's onUpdate so a svton `onProgress(message)` becomes a Pi update. */
function makeOnProgress(onUpdate: PiUpdate): (message: string) => void {
  return (message) => {
    try {
      onUpdate({ content: [{ type: 'text', text: message }], details: {} });
    } catch {
      // onUpdate is scoped to the active execute() call; calls after settle
      // are ignored by Pi, and a throwing callback must never break the tool.
    }
  };
}

/**
 * Normalize a svton JSON-Schema `ToolParameterSchema` into a JSON-Schema object
 * safe for pi-ai's TypeBox-based validator. pi-ai accepts standard JSON Schema
 * (TypeBox is JSON-Schema-compatible), so this is normalization, not a rewrite:
 *   - guarantee `type:'object'` + a `properties` object exist
 *   - strip svton-only `annotations` (they are execution hints, not part of the
 *     LLM-visible schema; they drive `executionMode` instead)
 * Returns a shallow copy so the registry's stored definition is never mutated.
 */
function normalizeParameters(def: ToolDefinition): AgentTool['parameters'] {
  const src = def.parameters;
  if (!src || typeof src !== 'object') {
    return { type: 'object', properties: {}, additionalProperties: true } as unknown as AgentTool['parameters'];
  }
  const { annotations: _dropped, ...rest } = src as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...rest };
  if (normalized.type !== 'object') normalized.type = 'object';
  if (!normalized.properties || typeof normalized.properties !== 'object') {
    normalized.properties = {};
  }
  return normalized as unknown as AgentTool['parameters'];
}

/**
 * Map svton `ToolAnnotations` → Pi `executionMode` (Architecture §5.3):
 * "All mutating, shell and interactive tools default to sequential execution.
 *  Only proven-independent read-only tools may opt into parallel execution."
 *
 *   - destructiveHint:true → 'sequential' (forces serial even if global is parallel)
 *   - readOnlyHint:true AND NOT destructive → 'parallel' (opt-in)
 *   - otherwise → undefined (fall back to the global default, which is sequential)
 */
function annotationsToExecutionMode(
  annotations: ToolAnnotations | undefined,
): AgentTool['executionMode'] {
  if (!annotations) return undefined;
  if (annotations.destructiveHint) return 'sequential';
  if (annotations.readOnlyHint) return 'parallel';
  return undefined;
}
