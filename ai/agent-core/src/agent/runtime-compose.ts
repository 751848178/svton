/**
 * Pi `Agent` factory for `SvtonAgentRuntime` (Architecture §3, §7.2).
 *
 * Extracted from the composition root to keep `svton-agent-runtime.ts` under
 * the 200-line ceiling (code-structure-standards). Owns the single place where
 * a pi-agent-core `Agent` is constructed with svton's collaborators:
 *   - tools bridged from the ToolRegistry (`buildAgentTools`)
 *   - the credential-bound pi-ai `Models.streamSimple` streamFn
 *   - the `SvtonCompactor` wired into Pi's `transformContext`
 *   - the `ApprovalGate` wired into Pi's `beforeToolCall`
 *   - sequential tool execution (svton owns scheduling policy)
 */
import { Agent } from '@earendil-works/pi-agent-core';
import type { Model } from '@earendil-works/pi-ai';
import type { AgentConfig, AgentEvent } from './types';
import type { ToolRegistry } from '../tool/registry';
import type { ToolExecutionService } from './tool-executor';
import type { SvtonCompactor } from './svton-compactor';
import type { ApprovalGate } from './approval-gate';
import type { ToolEventSink } from './pi-tool-adapter';
import { buildAgentTools } from './pi-tool-adapter';
import { toAgentMessages } from './message-bridge';

/** Collaborators the composition root passes to the factory. */
export interface PiAgentBuildContext {
  systemPrompt: string;
  model: Model<any>;
  models: AgentConfig['models'];
  toolRegistry: ToolRegistry;
  toolExecService: ToolExecutionService;
  compactor: SvtonCompactor;
  approvalGate: ApprovalGate;
  initialMessages: AgentConfig['initialMessages'];
  /** Sink the compactor + tool events route through to consumers. */
  routeToolEvent: (ev: AgentEvent) => void;
}

/**
 * Build the Pi `Agent` with svton's collaborators. The returned agent owns the
 * loop/state; svton keeps the policy pipeline (via `buildAgentTools`) and the
 * compaction/approval seams.
 */
export function buildPiAgent(ctx: PiAgentBuildContext): Agent {
  const tools = buildAgentTools(ctx.toolRegistry, ctx.toolExecService, ctx.routeToolEvent);
  return new Agent({
    initialState: {
      systemPrompt: ctx.systemPrompt,
      model: ctx.model,
      tools,
      messages: ctx.initialMessages ? toAgentMessages(ctx.initialMessages) : [],
    },
    streamFn: ctx.models.streamSimple.bind(ctx.models),
    transformContext: ctx.compactor.toTransformContext((outcome) => {
      ctx.routeToolEvent({
        type: 'context_compacted',
        summary: outcome.summary
          ? `Compacted ${outcome.removed} messages. Summary: ${outcome.summary.slice(0, 200)}...`
          : `Compacted ${outcome.removed} messages to free context space.`,
      });
    }),
    beforeToolCall: ctx.approvalGate.toBeforeToolCall(),
    toolExecution: 'sequential',
  });
}

/** Rebuild the AgentTool set after the registry changes (e.g. MCP bridging). */
export function rebuildTools(
  registry: ToolRegistry,
  toolExecService: ToolExecutionService,
  sink: ToolEventSink,
): ReturnType<typeof buildAgentTools> {
  return buildAgentTools(registry, toolExecService, sink);
}
